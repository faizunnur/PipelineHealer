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

  // Process asynchronously - return 200 immediately
  processWebhookAsync(
    event,
    payload,
    pipeline,
    integration,
    supabase
  ).catch(console.error);

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

    // Upsert run record
    const { data: run } = await supabase
      .from("pipeline_runs")
      .upsert(
        {
          pipeline_id: pipeline.id,
          provider_run_id: parsed.runId!,
          commit_sha: parsed.commitSha,
          commit_message: parsed.commitMessage,
          branch: parsed.branch,
          triggered_by: parsed.triggeredBy,
          status:
            parsed.runStatus === "completed"
              ? parsed.runConclusion === "success"
                ? "success"
                : parsed.runConclusion === "failure"
                ? "failed"
                : "cancelled"
              : parsed.runStatus === "in_progress"
              ? "running"
              : "queued",
          started_at: payload.workflow_run?.run_started_at,
          completed_at:
            parsed.runStatus === "completed"
              ? new Date().toISOString()
              : null,
        },
        { onConflict: "pipeline_id,provider_run_id" }
      )
      .select()
      .single();

    // Update pipeline last status
    await supabase
      .from("pipelines")
      .update({
        last_run_id: run?.id,
        last_status:
          parsed.runStatus === "completed"
            ? parsed.runConclusion ?? "unknown"
            : parsed.runStatus ?? "unknown",
      })
      .eq("id", pipeline.id);
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

    // Upsert job record
    const { data: dbJob } = await supabase
      .from("pipeline_jobs")
      .upsert(
        {
          run_id: run.id,
          provider_job_id: job.id,
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

      await orchestrateHealing({
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
