"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, User, GitBranch, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatRelativeTime,
  formatDuration,
  truncateCommitMessage,
  truncateCommitSha,
} from "@/lib/utils";

type Job = {
  id: string;
  job_name: string;
  status: string;
  duration_seconds: number | null;
  error_excerpt: string | null;
};

type Run = {
  id: string;
  status: string;
  branch: string;
  commit_sha: string;
  commit_message: string | null;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  pipeline_jobs: Job[] | null;
};

interface Props {
  pipelineId: string;
  initialRuns: Run[];
  provider: string;
}

const ACTIVE_STATUSES = new Set(["running", "queued"]);

function isActive(runs: Run[]) {
  return runs.some((r) => ACTIVE_STATUSES.has(r.status));
}

// Elapsed time hook for a running start timestamp
function useElapsed(startedAt: string | null, active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || !startedAt) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, active]);
  return elapsed;
}

function ElapsedTimer({ startedAt }: { startedAt: string | null }) {
  const elapsed = useElapsed(startedAt, true);
  return <span>{formatDuration(elapsed)}</span>;
}

function StatusDot({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-2 h-2" : "w-3 h-3";
  if (status === "running") {
    return (
      <span className="relative flex-shrink-0 mt-1">
        <span className={`${sz} rounded-full bg-primary block animate-ping absolute opacity-60`} />
        <span className={`${sz} rounded-full bg-primary block relative`} />
      </span>
    );
  }
  if (status === "queued") {
    return <span className={`${sz} rounded-full bg-muted-foreground/60 flex-shrink-0 mt-1 animate-pulse`} />;
  }
  const colors: Record<string, string> = {
    success: "bg-success",
    failed: "bg-destructive",
    cancelled: "bg-muted-foreground",
    skipped: "bg-muted-foreground/40",
  };
  return <span className={`${sz} rounded-full flex-shrink-0 mt-1 ${colors[status] ?? "bg-muted-foreground"}`} />;
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

function RunCard({ run }: { run: Run }) {
  const jobs = run.pipeline_jobs ?? [];
  const running = run.status === "running";

  return (
    <Card className={`overflow-hidden transition-all ${running ? "ring-1 ring-primary/40 shadow-md shadow-primary/10" : ""}`}>
      {/* Running progress bar */}
      {running && (
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-primary origin-left animate-[shimmer_2s_ease-in-out_infinite]"
            style={{ animation: "progress-shimmer 2s ease-in-out infinite" }} />
        </div>
      )}

      <CardContent className="p-0">
        <div className="flex items-start gap-3 p-4">
          <StatusDot status={run.status} />

          <div className="flex-1 min-w-0">
            {/* Commit info */}
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                {truncateCommitSha(run.commit_sha)}
              </code>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <GitBranch className="w-3 h-3" /> {run.branch}
              </span>
            </div>
            <p className="text-sm font-medium mt-0.5 truncate">
              {truncateCommitMessage(run.commit_message)}
            </p>

            {/* Meta */}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
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
              {running ? (
                <span className="flex items-center gap-1 text-primary font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <ElapsedTimer startedAt={run.started_at} />
                </span>
              ) : run.duration_seconds ? (
                <span>{formatDuration(run.duration_seconds)}</span>
              ) : null}
            </div>
          </div>

          <StatusBadge status={run.status} />
        </div>

        {/* Jobs */}
        {jobs.length > 0 && (
          <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-2 text-xs">
                <StatusDot status={job.status} size="sm" />
                <span className="font-medium flex-1 truncate">{job.job_name}</span>
                {job.status === "running" && (
                  <span className="text-primary text-xs font-medium animate-pulse">running…</span>
                )}
                {job.status === "queued" && (
                  <span className="text-muted-foreground text-xs">queued</span>
                )}
                {job.duration_seconds && (
                  <span className="text-muted-foreground">{formatDuration(job.duration_seconds)}</span>
                )}
                {job.status === "failed" && job.error_excerpt && (
                  <Badge variant="destructive" className="text-xs">Error</Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error excerpt */}
        {run.status === "failed" && jobs.some((j) => j.error_excerpt) && (
          <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-xs font-medium text-destructive mb-1">Error excerpt</p>
            {jobs.filter((j) => j.error_excerpt).slice(0, 1).map((j) => (
              <pre key={j.id} className="text-xs font-mono text-destructive/90 whitespace-pre-wrap break-all line-clamp-4">
                {j.error_excerpt}
              </pre>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LivePipelineRuns({ pipelineId, initialRuns, provider }: Props) {
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/runs`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs ?? []);
        setLastRefreshed(new Date());
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [pipelineId]);

  // Schedule next poll
  useEffect(() => {
    const scheduleNext = () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      // Poll fast (3s) when running, slow (15s) when idle
      const delay = isActive(runs) ? 3000 : 15000;
      pollingRef.current = setTimeout(async () => {
        await poll();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => { if (pollingRef.current) clearTimeout(pollingRef.current); };
  }, [runs, poll]);

  const activeRuns = runs.filter((r) => ACTIVE_STATUSES.has(r.status));
  const hasActive = activeRuns.length > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Pipeline Runs
        </h2>
        <div className="flex items-center gap-2">
          {hasActive && (
            <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <span className="relative flex w-2 h-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Live
            </span>
          )}
          <button
            onClick={() => poll(false)}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {formatRelativeTime(lastRefreshed.toISOString())}
          </button>
        </div>
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <p className="font-medium text-sm">No runs yet</p>
            <p className="text-muted-foreground text-xs max-w-sm mx-auto">
              Status shows <strong>Unknown</strong> until the first pipeline run is received.
              Make sure a webhook is configured on this repository, then push a commit
              {provider === "github" && " — or click Run Pipeline above to trigger a manual run"}.
            </p>
          </CardContent>
        </Card>
      ) : (
        runs.map((run) => <RunCard key={run.id} run={run} />)
      )}
    </div>
  );
}
