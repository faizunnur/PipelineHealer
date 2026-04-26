import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Github, Gitlab, GitCommit, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatRelativeTime,
  formatDuration,
  truncateCommitMessage,
  truncateCommitSha,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!pipeline) notFound();

  const { data: runs } = await supabase
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pipelines">
            <ArrowLeft className="w-4 h-4" />
            Pipelines
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {pipeline.provider === "github" ? (
            <Github className="w-5 h-5" />
          ) : (
            <Gitlab className="w-5 h-5 text-orange-500" />
          )}
          <h1 className="text-xl font-bold">{pipeline.repo_full_name}</h1>
          <StatusBadge status={pipeline.last_status ?? "unknown"} />
        </div>
      </div>

      {/* Run History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Pipeline Runs
        </h2>

        {runs?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No runs yet. Push a commit to trigger your first pipeline run.
            </CardContent>
          </Card>
        )}

        {runs?.map((run) => {
          const jobs = run.pipeline_jobs as Array<{
            id: string;
            job_name: string;
            status: string;
            duration_seconds: number | null;
            error_excerpt: string | null;
          }> | null;

          return (
            <Card key={run.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Run header */}
                <div className="flex items-start gap-3 p-4">
                  <StatusDot status={run.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {truncateCommitSha(run.commit_sha)}
                      </code>
                      <span className="text-xs text-muted-foreground">
                        {run.branch}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-0.5">
                      {truncateCommitMessage(run.commit_message)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {run.triggered_by && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {run.triggered_by}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(run.created_at)}
                      </span>
                      {run.duration_seconds && (
                        <span>{formatDuration(run.duration_seconds)}</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={run.status} />
                </div>

                {/* Jobs */}
                {jobs && jobs.length > 0 && (
                  <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-2">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <StatusDot status={job.status} size="sm" />
                        <span className="font-medium flex-1">{job.job_name}</span>
                        {job.duration_seconds && (
                          <span className="text-muted-foreground">
                            {formatDuration(job.duration_seconds)}
                          </span>
                        )}
                        {job.status === "failed" && job.error_excerpt && (
                          <Badge variant="destructive" className="text-xs">
                            Error
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatusDot({
  status,
  size = "md",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "w-2 h-2" : "w-3 h-3";
  const colors: Record<string, string> = {
    success: "bg-success",
    failed: "bg-destructive",
    running: "bg-primary animate-pulse",
    queued: "bg-muted-foreground",
    cancelled: "bg-muted-foreground",
    skipped: "bg-muted-foreground/50",
  };
  return (
    <div
      className={`${sizeClass} rounded-full flex-shrink-0 mt-1 ${colors[status] ?? "bg-muted-foreground"}`}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
    success: { label: "Success", variant: "success" },
    failure: { label: "Failed", variant: "destructive" },
    failed: { label: "Failed", variant: "destructive" },
    running: { label: "Running", variant: "warning" },
    queued: { label: "Queued", variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "secondary" },
    unknown: { label: "Unknown", variant: "secondary" },
  };
  const info = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant} className="text-xs flex-shrink-0">{info.label}</Badge>;
}
