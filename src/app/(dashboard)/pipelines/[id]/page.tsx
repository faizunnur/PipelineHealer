import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { PipelineDetailClient } from "@/components/pipelines/PipelineDetailClient";

export const dynamic = "force-dynamic";

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;

  const db = createAdminClient();
  const { data: pipeline } = await db
    .from("pipelines")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) notFound();

  const { data: runs } = await db
    .from("pipeline_runs")
    .select(
      `id, status, branch, commit_sha, commit_message, triggered_by,
       started_at, completed_at, duration_seconds, created_at,
       pipeline_jobs(id, job_name, status, duration_seconds, error_excerpt)`
    )
    .eq("pipeline_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <PipelineDetailClient
      pipeline={{
        id: pipeline.id,
        repo_full_name: pipeline.repo_full_name,
        provider: pipeline.provider,
        default_branch: pipeline.default_branch,
        last_status: pipeline.last_status,
        webhook_status: pipeline.webhook_status,
      }}
      initialRuns={(runs ?? []) as Parameters<typeof PipelineDetailClient>[0]["initialRuns"]}
    />
  );
}
