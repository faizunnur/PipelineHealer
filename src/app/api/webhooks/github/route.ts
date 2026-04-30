import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGitHubSignature } from "@/lib/webhooks/signature-verify";
import {
  parseGitHubWorkflowRun,
  parseGitHubWorkflowJob,
} from "@/lib/webhooks/github-parser";
import { extractErrorExcerpt } from "@/lib/healing/error-extractor";
import { orchestrateHealing } from "@/lib/healing/orchestrator";
import {
  fetchJobLog,
  fetchWorkflowContent,
} from "@/lib/github/workflow-updater";
import { decrypt } from "@/lib/crypto/decrypt";

// GitHub sends a GET ping when the webhook is first saved — must return 200
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await req.text();
  const event = req.headers.get("x-github-event") ?? "";
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  if (!["workflow_run", "workflow_job"].includes(event)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const payload = JSON.parse(rawBody);
  const repoFullName: string = payload.repository?.full_name;

  if (!repoFullName) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Find matching integration + pipeline by repo name
  const { data: pipeline } = await supabase
    .from("pipelines")
    .select(
      `id, user_id, integration_id,
       integrations(webhook_secret, encrypted_token, token_iv, token_tag)`
    )
    .eq("repo_full_name", repoFullName)
    .eq("provider", "github")
    .eq("is_monitored", true)
    .single();

  if (!pipeline) {
    // No pipeline registered - return 200 to avoid GitHub retries
    return NextResponse.json({ ok: true, skipped: "no_pipeline" });
  }

  const integration = pipeline.integrations as {
    webhook_secret: string;
    encrypted_token: string;
    token_iv: string;
    token_tag: string;
  } | null;

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 400 });
  }

  // Verify webhook signature
  if (!verifyGitHubSignature(rawBody, integration.webhook_secret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Process asynchronously - return 200 immediately so GitHub doesn't retry
  processWebhookAsync(event, payload, pipeline, integration, supabase).catch((err) => {
    console.error("[webhook/github] processWebhookAsync failed:", err);
  });

  return NextResponse.json({ ok: true });
}

async function processWebhookAsync(
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  pipeline: { id: string; user_id: string; integration_id: string },
  integration: {
    webhook_secret: string;
    encrypted_token: string;
    token_iv: string;
    token_tag: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  if (event === "workflow_run") {
    const parsed = parseGitHubWorkflowRun(payload);

    const runStatus =
      parsed.runStatus === "completed"
        ? parsed.runConclusion === "success"
          ? "success"
          : parsed.runConclusion === "failure"
          ? "failed"
          : "cancelled"
        : parsed.runStatus === "in_progress"
        ? "running"
        : "queued";

    // Upsert run record (requires UNIQUE constraint on pipeline_id,provider_run_id — migration 0014)
    const { data: run, error: runError } = await supabase
      .from("pipeline_runs")
      .upsert(
        {
          pipeline_id: pipeline.id,
          provider_run_id: String(parsed.runId!),
          commit_sha: parsed.commitSha ?? "",
          commit_message: parsed.commitMessage ?? null,
          branch: parsed.branch ?? "",
          triggered_by: parsed.triggeredBy ?? null,
          status: runStatus,
          started_at: payload.workflow_run?.run_started_at ?? null,
          completed_at: parsed.runStatus === "completed" ? new Date().toISOString() : null,
        },
        { onConflict: "pipeline_id,provider_run_id" }
      )
      .select()
      .single();

    if (runError) {
      console.error("[webhook/github] pipeline_runs upsert failed:", runError.message, runError.details);
      return;
    }

    // Update pipeline last status + consecutive_failures counter
    const isRunFailure = parsed.runStatus === "completed" && parsed.runConclusion === "failure";
    const isRunSuccess = parsed.runStatus === "completed" && parsed.runConclusion === "success";

    if (isRunFailure) {
      // Read current counter, then increment
      const { data: pl } = await supabase
        .from("pipelines")
        .select("consecutive_failures")
        .eq("id", pipeline.id)
        .single();

      const newCount = (pl?.consecutive_failures ?? 0) + 1;
      await supabase
        .from("pipelines")
        .update({ last_run_id: run?.id, last_status: parsed.runConclusion ?? "unknown", consecutive_failures: newCount })
        .eq("id", pipeline.id);

      // Check auto-issue rule
      await maybeCreateAutoIssue(supabase, pipeline, run, newCount, parsed, integration, payload);
    } else {
      await supabase
        .from("pipelines")
        .update({
          last_run_id: run?.id,
          last_status:
            parsed.runStatus === "completed"
              ? parsed.runConclusion ?? "unknown"
              : parsed.runStatus ?? "unknown",
          ...(isRunSuccess ? { consecutive_failures: 0 } : {}),
        })
        .eq("id", pipeline.id);
    }
  } else if (event === "workflow_job") {
    const parsed = parseGitHubWorkflowJob(payload);
    const job = parsed.jobs?.[0];
    if (!job) return;

    // Find the run
    const { data: run } = await supabase
      .from("pipeline_runs")
      .select("id")
      .eq("pipeline_id", pipeline.id)
      .eq("provider_run_id", parsed.runId!)
      .single();

    if (!run) return;

    const isFailure =
      job.status === "completed" && job.conclusion === "failure";
    let errorExcerpt: string | null = null;

    if (isFailure) {
      // Fetch and extract job log
      const plainToken = decrypt({
        encrypted: integration.encrypted_token,
        iv: integration.token_iv,
        tag: integration.token_tag,
      });

      const rawLog = await fetchJobLog(
        plainToken,
        payload.repository.full_name,
        job.id
      );

      if (rawLog) {
        errorExcerpt = extractErrorExcerpt(rawLog);
      }
    }

    // Upsert job record (requires UNIQUE constraint on run_id,provider_job_id — migration 0014)
    const { data: dbJob, error: jobError } = await supabase
      .from("pipeline_jobs")
      .upsert(
        {
          run_id: run.id,
          provider_job_id: String(job.id),
          job_name: job.name,
          status:
            job.conclusion === "success"
              ? "success"
              : job.conclusion === "failure"
              ? "failed"
              : job.conclusion === "skipped"
              ? "skipped"
              : job.status === "in_progress"
              ? "running"
              : "queued",
          started_at: job.startedAt,
          completed_at: job.completedAt,
          error_excerpt: errorExcerpt,
        },
        { onConflict: "run_id,provider_job_id" }
      )
      .select()
      .single();

    if (jobError) {
      console.error("[webhook/github] pipeline_jobs upsert failed:", jobError.message, jobError.details);
    }

    // Trigger healing if job failed and we have an error
    if (isFailure && errorExcerpt && dbJob) {
      const plainToken = decrypt({
        encrypted: integration.encrypted_token,
        iv: integration.token_iv,
        tag: integration.token_tag,
      });

      // Try to fetch the workflow file for context
      const workflowFiles = [
        ".github/workflows/ci.yml",
        ".github/workflows/main.yml",
        ".github/workflows/deploy.yml",
        ".github/workflows/build.yml",
      ];

      let workflowContent: string | undefined;
      for (const path of workflowFiles) {
        const content = await fetchWorkflowContent(
          plainToken,
          payload.repository.full_name,
          path
        );
        if (content) {
          workflowContent = content;
          break;
        }
      }

      void orchestrateHealing({
        userId: pipeline.user_id,
        pipelineId: pipeline.id,
        runId: run.id,
        jobId: dbJob.id,
        errorExcerpt,
        workflowContext: {
          provider: "github",
          workflowContent,
          repoName: payload.repository.full_name,
          jobName: job.name,
          branch: parsed.branch,
        },
      });
    }
  }
}

async function maybeCreateAutoIssue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pipeline: { id: string; user_id: string; integration_id: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: any,
  consecutiveFailures: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed: any,
  integration: { encrypted_token: string; token_iv: string; token_tag: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
) {
  const { data: rule } = await supabase
    .from("auto_issue_rules")
    .select("id, consecutive_failures, labels, assignees, is_active")
    .eq("pipeline_id", pipeline.id)
    .eq("is_active", true)
    .single();

  if (!rule) return;
  if (consecutiveFailures < rule.consecutive_failures) return;

  // Check if we already have an open issue for this pipeline
  const { data: existing } = await supabase
    .from("auto_issues")
    .select("id")
    .eq("pipeline_id", pipeline.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return; // Don't duplicate open issues

  const repoFullName: string = payload.repository?.full_name;
  const branch = parsed.branch ?? "unknown";
  const title = `[CI Failure] ${repoFullName} has failed ${consecutiveFailures} times on ${branch}`;
  const body = [
    `## Automated CI Failure Alert`,
    ``,
    `The pipeline **${repoFullName}** on branch \`${branch}\` has failed **${consecutiveFailures} consecutive times**.`,
    ``,
    `**Latest run:** ${parsed.runId}`,
    `**Triggered by:** ${parsed.triggeredBy ?? "unknown"}`,
    `**Time:** ${new Date().toISOString()}`,
    ``,
    `> This issue was automatically created by PipelineHealer after ${rule.consecutive_failures} consecutive CI failures.`,
  ].join("\n");

  const plainToken = decrypt({
    encrypted: integration.encrypted_token,
    iv: integration.token_iv,
    tag: integration.token_tag,
  });

  try {
    const ghRes = await fetch(`https://api.github.com/repos/${repoFullName}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${plainToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        labels: rule.labels ?? [],
        assignees: rule.assignees ?? [],
      }),
    });

    if (ghRes.ok) {
      const issue = await ghRes.json();
      await supabase.from("auto_issues").insert({
        pipeline_id: pipeline.id,
        run_id: run?.id ?? null,
        user_id: pipeline.user_id,
        github_issue_number: issue.number,
        github_issue_url: issue.html_url,
        title,
        status: "open",
      });
    }
  } catch (err) {
    console.error("[webhook/github] auto-issue creation failed:", err);
  }
}
