import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, GitBranch, Github, Gitlab } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, truncateCommitMessage, truncateCommitSha } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PipelinesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select(
      `id, provider, repo_full_name, pipeline_name, default_branch,
       is_monitored, last_status, updated_at,
       pipeline_runs(id, status, branch, commit_sha, commit_message, created_at, triggered_by)`
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipelines</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All monitored repositories and their pipeline status
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/integrations/new">
            <Plus className="w-4 h-4" />
            Add Pipeline
          </Link>
        </Button>
      </div>

      {pipelines?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <GitBranch className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No pipelines yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect GitHub or GitLab to start monitoring pipelines
            </p>
            <Button asChild>
              <Link href="/integrations/new">
                <Plus className="w-4 h-4" />
                Add First Pipeline
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {pipelines?.map((pipeline) => {
          const runs = pipeline.pipeline_runs as Array<{
            id: string;
            status: string;
            branch: string;
            commit_sha: string;
            commit_message: string | null;
            created_at: string;
            triggered_by: string | null;
          }> | null;
          const latestRun = runs?.[0];

          return (
            <Card
              key={pipeline.id}
              className="hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {pipeline.provider === "github" ? (
                      <Github className="w-5 h-5" />
                    ) : (
                      <Gitlab className="w-5 h-5 text-orange-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/pipelines/${pipeline.id}`}
                        className="font-semibold hover:text-primary transition-colors"
                      >
                        {pipeline.repo_full_name}
                      </Link>
                      {pipeline.pipeline_name !== pipeline.repo_full_name && (
                        <span className="text-xs text-muted-foreground">
                          {pipeline.pipeline_name}
                        </span>
                      )}
                      <StatusBadge status={pipeline.last_status ?? "unknown"} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Branch: {pipeline.default_branch}
                    </p>
                    {latestRun && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last run:{" "}
                        {truncateCommitMessage(latestRun.commit_message)} ·{" "}
                        {truncateCommitSha(latestRun.commit_sha)} ·{" "}
                        {formatRelativeTime(latestRun.created_at)}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/pipelines/${pipeline.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
    success: { label: "Passing", variant: "success" },
    failure: { label: "Failed", variant: "destructive" },
    failed: { label: "Failed", variant: "destructive" },
    running: { label: "Running", variant: "warning" },
    queued: { label: "Queued", variant: "secondary" },
    unknown: { label: "Unknown", variant: "secondary" },
  };
  const info = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant} className="text-xs">{info.label}</Badge>;
}
