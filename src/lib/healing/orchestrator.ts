import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeAndHeal } from "@/lib/claude/healer";
import { postPRComment, findPRForCommit } from "@/lib/github/pr-commenter";

interface OrchestratorInput {
  userId: string;
  pipelineId: string;
  runId: string;
  jobId: string;
  errorExcerpt: string;
  workflowContext?: {
    provider: "github" | "gitlab";
    workflowContent?: string;
    repoName: string;
    jobName: string;
    branch: string;
  };
}

export async function orchestrateHealing(
  input: OrchestratorInput
): Promise<void> {
  const supabase = createAdminClient();

  // Check token budget before calling Claude
  const { data: profile } = await supabase
    .from("profiles")
    .select("tokens_used, token_budget, approval_mode, is_suspended")
    .eq("id", input.userId)
    .single();

  if (!profile || profile.is_suspended) {
    console.warn(`Healing skipped: user ${input.userId} is suspended`);
    return;
  }

  if (profile.tokens_used >= profile.token_budget) {
    console.warn(`Healing skipped: user ${input.userId} exceeded token budget`);
    // Create a healing event noting budget exceeded
    await supabase.from("healing_events").insert({
      user_id: input.userId,
      pipeline_id: input.pipelineId,
      run_id: input.runId,
      job_id: input.jobId,
      error_excerpt: input.errorExcerpt,
      ai_reason: "Token budget exceeded. Please increase your token budget in settings.",
      ai_solution: null,
      ai_file_path: null,
      ai_original_code: null,
      ai_fixed_code: null,
      ai_tokens_used: 0,
      status: "rejected",
      approval_mode: profile.approval_mode,
    });
    return;
  }

  // Create pending healing event
  const { data: healingEvent, error: insertError } = await supabase
    .from("healing_events")
    .insert({
      user_id: input.userId,
      pipeline_id: input.pipelineId,
      run_id: input.runId,
      job_id: input.jobId,
      error_excerpt: input.errorExcerpt,
      status: "pending_review",
      approval_mode: profile.approval_mode,
    })
    .select()
    .single();

  if (insertError || !healingEvent) {
    console.error("Failed to create healing event:", insertError);
    return;
  }

  try {
    // Call Claude for analysis
    const analysis = await analyzeAndHeal(
      input.errorExcerpt,
      input.workflowContext
    );

    // Update healing event with AI results
    await supabase
      .from("healing_events")
      .update({
        ai_reason: analysis.reason,
        ai_solution: analysis.solution,
        ai_file_path: analysis.file_path,
        ai_original_code: analysis.original_code,
        ai_fixed_code: analysis.fixed_code,
        ai_tokens_used: analysis.tokens_used,
        status:
          profile.approval_mode === "auto" ? "approved" : "pending_review",
        approved_at:
          profile.approval_mode === "auto" ? new Date().toISOString() : null,
      })
      .eq("id", healingEvent.id);

    // Log token usage
    await supabase.from("token_usage_log").insert({
      user_id: input.userId,
      feature: "healing",
      model: "claude-sonnet-4-6",
      tokens_in: Math.floor(analysis.tokens_used * 0.7),
      tokens_out: Math.floor(analysis.tokens_used * 0.3),
      ref_id: healingEvent.id,
    });

    // Increment token count
    await supabase.rpc("increment_token_usage", {
      p_user_id: input.userId,
      p_amount: analysis.tokens_used,
    });

    // If auto-approve mode and we have a fix, apply it immediately
    if (
      profile.approval_mode === "auto" &&
      analysis.file_path &&
      analysis.fixed_code
    ) {
      await applyFix(healingEvent.id, input.userId);
    }

    // Auto-post PR comment if this run is associated with a PR (GitHub only)
    if (
      input.workflowContext?.provider === "github" &&
      analysis.reason
    ) {
      postPRCommentIfApplicable(
        healingEvent.id,
        input.userId,
        input.runId,
        input.pipelineId,
        analysis
      ).catch(() => {}); // fire-and-forget, don't block healing
    }
  } catch (err) {
    console.error("Healing analysis failed:", err);
    await supabase
      .from("healing_events")
      .update({
        ai_reason: "AI analysis failed. Please review the error manually.",
        ai_solution: String(err),
        status: "pending_review",
      })
      .eq("id", healingEvent.id);
  }
}

export async function applyFix(
  healingEventId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("healing_events")
    .select(
      `*, pipelines(provider, repo_full_name, integration_id, integrations(encrypted_token, token_iv, token_tag))`
    )
    .eq("id", healingEventId)
    .single();

  if (!event) return { success: false, error: "Healing event not found" };
  if (!event.ai_file_path || !event.ai_fixed_code || !event.ai_original_code) {
    return { success: false, error: "No fix available to apply" };
  }

  await supabase
    .from("healing_events")
    .update({ status: "applying" })
    .eq("id", healingEventId);

  try {
    const pipeline = event.pipelines as {
      provider: string;
      repo_full_name: string;
      integration_id: string;
      integrations: { encrypted_token: string; token_iv: string; token_tag: string };
    } | null;

    if (!pipeline) throw new Error("Pipeline data not found");

    const { decrypt } = await import("@/lib/crypto/decrypt");
    const plainToken = decrypt({
      encrypted: pipeline.integrations.encrypted_token,
      iv: pipeline.integrations.token_iv,
      tag: pipeline.integrations.token_tag,
    });

    if (pipeline.provider === "github") {
      const { applyGitHubFix } = await import("@/lib/github/workflow-updater");
      await applyGitHubFix({
        token: plainToken,
        repoFullName: pipeline.repo_full_name,
        filePath: event.ai_file_path,
        originalCode: event.ai_original_code,
        fixedCode: event.ai_fixed_code,
        reason: event.ai_reason ?? "Auto-heal fix",
      });
    } else {
      const { applyGitLabFix } = await import("@/lib/gitlab/pipeline-updater");
      await applyGitLabFix({
        token: plainToken,
        repoFullName: pipeline.repo_full_name,
        filePath: event.ai_file_path,
        originalCode: event.ai_original_code,
        fixedCode: event.ai_fixed_code,
        reason: event.ai_reason ?? "Auto-heal fix",
      });
    }

    await supabase
      .from("healing_events")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", healingEventId);

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("healing_events")
      .update({ status: "apply_failed", apply_error: errorMsg })
      .eq("id", healingEventId);

    return { success: false, error: errorMsg };
  }
}

async function postPRCommentIfApplicable(
  healingEventId: string,
  userId: string,
  runId: string,
  pipelineId: string,
  analysis: { reason: string; solution: string; file_path: string | null; original_code: string | null; fixed_code: string | null }
): Promise<void> {
  const supabase = createAdminClient();

  const [{ data: run }, { data: pipeline }] = await Promise.all([
    supabase.from("pipeline_runs").select("commit_sha").eq("id", runId).single(),
    supabase.from("pipelines").select("repo_full_name, integration_id, integrations(encrypted_token, token_iv, token_tag)")
      .eq("id", pipelineId).single(),
  ]);

  if (!run?.commit_sha || !pipeline) return;

  const pipelineData = pipeline as {
    repo_full_name: string;
    integrations: { encrypted_token: string; token_iv: string; token_tag: string };
  };

  const { decrypt } = await import("@/lib/crypto/decrypt");
  const plainToken = decrypt({
    encrypted: pipelineData.integrations.encrypted_token,
    iv: pipelineData.integrations.token_iv,
    tag: pipelineData.integrations.token_tag,
  });

  const prNumber = await findPRForCommit(plainToken, pipelineData.repo_full_name, run.commit_sha);
  if (!prNumber) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
  await postPRComment({
    token: plainToken,
    repoFullName: pipelineData.repo_full_name,
    prNumber,
    reason: analysis.reason,
    solution: analysis.solution,
    filePath: analysis.file_path,
    originalCode: analysis.original_code,
    fixedCode: analysis.fixed_code,
    healingEventId,
    appUrl,
  });
}
