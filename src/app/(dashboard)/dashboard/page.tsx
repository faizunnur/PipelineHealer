import { createClient } from "@/lib/supabase/server";
import {
  GitBranch,
  CheckCircle2,
  XCircle,
  Wrench,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatRelativeTime, truncateCommitMessage, truncateCommitSha } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch stats in parallel
  const [
    { count: totalPipelines },
    { data: recentRuns },
    { data: pendingHealing },
    { data: recentHealing },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("pipelines")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("pipeline_runs")
      .select(
        `id, status, branch, commit_sha, commit_message, created_at,
         pipelines!inner(repo_full_name, user_id)`
      )
      .eq("pipelines.user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("healing_events")
      .select("id, created_at, pipeline_id, pipelines(repo_full_name)")
      .eq("user_id", user.id)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("healing_events")
      .select("id, status, created_at, ai_reason, pipelines(repo_full_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("tokens_used, token_budget")
      .eq("id", user.id)
      .single(),
  ]);

  const successCount =
    recentRuns?.filter((r) => r.status === "success").length ?? 0;
  const failedCount =
    recentRuns?.filter((r) => r.status === "failed").length ?? 0;
  const tokenPercent = profile
    ? Math.round((profile.tokens_used / profile.token_budget) * 100)
    : 0;

  const stats = [
    {
      title: "Active Pipelines",
      value: totalPipelines ?? 0,
      icon: GitBranch,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Recent Successes",
      value: successCount,
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "Recent Failures",
      value: failedCount,
      icon: XCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      title: "Pending Fixes",
      value: pendingHealing?.length ?? 0,
      icon: Wrench,
      color: "text-warning",
      bg: "bg-warning/10",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your pipeline health at a glance
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/integrations/new">
            <Zap className="w-4 h-4" />
            Add Pipeline
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}
                  >
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stat.title}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Runs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Recent Pipeline Runs
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/pipelines" className="text-xs">
                  View all
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentRuns?.length === 0 && (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No pipeline runs yet. Connect a repository to get started.
              </p>
            )}
            {recentRuns?.map((run) => (
              <div
                key={run.id}
                className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
              >
                <StatusDot status={run.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {truncateCommitMessage(run.commit_message)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {truncateCommitSha(run.commit_sha)} · {run.branch}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatRelativeTime(run.created_at)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pending Healing */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-warning" />
                Pending Fixes
                {(pendingHealing?.length ?? 0) > 0 && (
                  <Badge variant="warning" className="text-xs">
                    {pendingHealing?.length}
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/healing" className="text-xs">
                  View all
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(pendingHealing?.length ?? 0) === 0 && (
              <div className="py-8 text-center">
                <TrendingUp className="w-8 h-8 text-success mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  All pipelines healthy!
                </p>
              </div>
            )}
            {pendingHealing?.map((event) => {
              const pipeline = event.pipelines as { repo_full_name: string } | null;
              return (
                <Link
                  key={event.id}
                  href={`/healing/${event.id}`}
                  className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {pipeline?.repo_full_name ?? "Unknown repo"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Awaiting review
                    </p>
                  </div>
                  <Badge variant="warning" className="text-xs flex-shrink-0">
                    Review
                  </Badge>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent Healing Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            AI Healing Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(recentHealing?.length ?? 0) === 0 && (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No healing events yet. They&apos;ll appear here when pipelines fail.
            </p>
          )}
          <div className="space-y-3">
            {recentHealing?.map((event) => {
              const pipeline = event.pipelines as { repo_full_name: string } | null;
              return (
                <Link
                  key={event.id}
                  href={`/healing/${event.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-border/50"
                >
                  <HealingStatusIcon status={event.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {pipeline?.repo_full_name ?? "Unknown"}
                    </p>
                    {event.ai_reason && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {event.ai_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <StatusBadge status={event.status} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(event.created_at)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Token Usage */}
      {profile && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">AI Token Usage</span>
              <span className="text-sm text-muted-foreground">
                {profile.tokens_used.toLocaleString()} /{" "}
                {profile.token_budget.toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  tokenPercent > 80 ? "bg-destructive" : tokenPercent > 60 ? "bg-warning" : "bg-primary"
                }`}
                style={{ width: `${Math.min(tokenPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {tokenPercent}% of monthly budget used
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "bg-success",
    failed: "bg-destructive",
    running: "bg-primary animate-pulse",
    queued: "bg-muted-foreground",
    cancelled: "bg-muted-foreground",
  };
  return (
    <div
      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[status] ?? "bg-muted-foreground"}`}
    />
  );
}

function HealingStatusIcon({ status }: { status: string }) {
  if (status === "applied")
    return <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />;
  if (status === "rejected")
    return <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />;
  return <Wrench className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
    applied: { label: "Fixed", variant: "success" },
    rejected: { label: "Rejected", variant: "destructive" },
    pending_review: { label: "Pending", variant: "warning" },
    applying: { label: "Applying", variant: "warning" },
    apply_failed: { label: "Failed", variant: "destructive" },
  };
  const info = map[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={info.variant} className="text-xs">{info.label}</Badge>;
}
