import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Github, Gitlab } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TriggerButton } from "@/components/pipelines/TriggerButton";
import { DeletePipelineButton } from "@/components/pipelines/DeletePipelineButton";
import { WebhookSetupButton } from "@/components/pipelines/WebhookSetupButton";
import { LivePipelineRuns } from "@/components/pipelines/LivePipelineRuns";

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
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pipelines">
            <ArrowLeft className="w-4 h-4" />
            Pipelines
          </Link>
        </Button>
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {pipeline.provider === "github" ? (
            <Github className="w-5 h-5" />
          ) : (
            <Gitlab className="w-5 h-5 text-orange-500" />
          )}
          <h1 className="text-xl font-bold">{pipeline.repo_full_name}</h1>
          <StatusBadge status={pipeline.last_status ?? "unknown"} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pipeline.provider === "github" && (
            <TriggerButton
              pipelineId={pipeline.id}
              defaultBranch={pipeline.default_branch}
            />
          )}
          <WebhookSetupButton
            pipelineId={pipeline.id}
            initialStatus={pipeline.webhook_status ?? null}
          />
          <DeletePipelineButton
            pipelineId={pipeline.id}
            repoName={pipeline.repo_full_name}
            variant="full"
            redirectAfter="/pipelines"
          />
        </div>
      </div>

      {/* Live runs — client component that polls every 3s when active */}
      <LivePipelineRuns
        pipelineId={pipeline.id}
        initialRuns={(runs ?? []) as Parameters<typeof LivePipelineRuns>[0]["initialRuns"]}
        provider={pipeline.provider}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
    success:   { label: "Success",   variant: "success" },
    failure:   { label: "Failed",    variant: "destructive" },
    failed:    { label: "Failed",    variant: "destructive" },
    running:   { label: "Running",   variant: "warning" },
    queued:    { label: "Queued",    variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "secondary" },
    unknown:   { label: "Unknown",   variant: "secondary" },
  };
  const info = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant} className="text-xs flex-shrink-0">{info.label}</Badge>;
}
