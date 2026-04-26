import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGitLabToken } from "@/lib/webhooks/signature-verify";
import {
  parseGitLabJobEvent,
  parseGitLabPipelineEvent,
} from "@/lib/webhooks/gitlab-parser";
import { extractErrorExcerpt } from "@/lib/healing/error-extractor";
import { orchestrateHealing } from "@/lib/healing/orchestrator";
import { fetchGitLabJobLog } from "@/lib/gitlab/pipeline-updater";
import { decrypt } from "@/lib/crypto/decrypt";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const eventType = req.headers.get("x-gitlab-event") ?? "";
  const token = req.headers.get("x-gitlab-token") ?? "";

  const payload = JSON.parse(rawBody);
  const repoFullName: string =
    payload.project?.path_with_namespace ?? payload.project_name ?? "";

  if (!repoFullName) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select(
      `id, user_id, integration_id,
       integrations(webhook_secret, encrypted_token, token_iv, token_tag)`
    )
    .ilike("repo_full_name", repoFullName)
    .eq("provider", "gitlab")
    .eq("is_monitored", true)
    .single();

  if (!pipeline) {
    return NextResponse.json({ ok: true, skipped: "no_pipeline" });
  }

  const integration = pipeline.integrations as {
    webhook_secret: string;
    encrypted_token: string;
    token_iv: string;
    token_tag: string;
  } | null;

  if (!integration || !verifyGitLabToken(token, integration.webhook_secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  processGitLabWebhook(
    eventType,
    payload,
    pipeline,
    integration,
    supabase
  ).catch(console.error);

  return NextResponse.json({ ok: true });
}

async function processGitLabWebhook(
  eventType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  pipeline: { id: string; user_id: string },
  integration: {
    encrypted_token: string;
    token_iv: string;
    token_tag: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  if (eventType === "Pipeline Hook") {
    const parsed = parseGitLabPipelineEvent(payload);

    const statusMap: Record<string, string> = {
      pending: "queued",
      running: "running",
      success: "success",
      failed: "failed",
      canceled: "cancelled",
    };

    await supabase.from("pipeline_runs").upsert(
      {
        pipeline_id: pipeline.id,
        provider_run_id: parsed.pipelineId!,
        commit_sha: parsed.commitSha,
        commit_message: parsed.commitMessage,
        branch: parsed.branch,
        triggered_by: parsed.triggeredBy,
        status: statusMap[parsed.status ?? ""] ?? "queued",
        completed_at: ["success", "failed", "canceled"].includes(
          parsed.status ?? ""
        )
          ? new Date().toISOString()
          : null,
      },
      { onConflict: "pipeline_id,provider_run_id" }
    );

    await supabase.from("pipelines").update({
      last_status: parsed.status ?? "unknown",
    }).eq("id", pipeline.id);
  } else if (eventType === "Job Hook") {
    const parsed = parseGitLabJobEvent(payload);
    const isFailure = parsed.status === "failed";

    const { data: run } = await supabase
      .from("pipeline_runs")
      .select("id")
      .eq("pipeline_id", pipeline.id)
      .eq("provider_run_id", parsed.pipelineId!)
      .single();

    if (!run) return;

    let errorExcerpt: string | null = null;
    if (isFailure && parsed.jobId) {
      const plainToken = decrypt({
        encrypted: integration.encrypted_token,
        iv: integration.token_iv,
        tag: integration.token_tag,
      });

      const rawLog = await fetchGitLabJobLog(
        plainToken,
        payload.project?.path_with_namespace ?? "",
        parsed.jobId
      );

      if (rawLog) errorExcerpt = extractErrorExcerpt(rawLog);
    }

    const { data: dbJob } = await supabase
      .from("pipeline_jobs")
      .upsert(
        {
          run_id: run.id,
          provider_job_id: parsed.jobId!,
          job_name: parsed.jobName ?? "unknown",
          status:
            parsed.status === "success"
              ? "success"
              : parsed.status === "failed"
              ? "failed"
              : "running",
          error_excerpt: errorExcerpt,
        },
        { onConflict: "run_id,provider_job_id" }
      )
      .select()
      .single();

    if (isFailure && errorExcerpt && dbJob) {
      await orchestrateHealing({
        userId: pipeline.user_id,
        pipelineId: pipeline.id,
        runId: run.id,
        jobId: dbJob.id,
        errorExcerpt,
        workflowContext: {
          provider: "gitlab",
          repoName: payload.project?.path_with_namespace ?? "",
          jobName: parsed.jobName ?? "unknown",
          branch: parsed.branch,
        },
      });
    }
  }
}
