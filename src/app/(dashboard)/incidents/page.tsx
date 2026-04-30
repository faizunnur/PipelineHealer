"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, ChevronDown, ChevronRight, GitBranch, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Run = {
  id: string;
  pipeline_id: string;
  status: string;
  branch: string | null;
  commit_sha: string | null;
  commit_message: string | null;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  pipeline_jobs: Job[];
};
type Job = {
  id: string;
  job_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_excerpt: string | null;
};
type IncidentGroup = {
  branch: string;
  pipeline_id: string;
  repo_name: string;
  runs: Run[];
  failureStart: string;
  recoveredAt: string | null;
  durationHours: number | null;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDur(s: number | null) {
  if (!s) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentGroup[]>([]);
  const [recentRuns, setRecentRuns] = useState<(Run & { repo_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/incidents");
    if (res.ok) {
      const d = await res.json();
      setIncidents(d.incidents ?? []);
      setRecentRuns(d.recentRuns ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openIncidents = incidents.filter((i) => !i.recoveredAt);
  const closedIncidents = incidents.filter((i) => i.recoveredAt);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-primary" /> Incident Timeline
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track pipeline failures, MTTR, and critical path analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {openIncidents.length > 0 && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/30">
              {openIncidents.length} active incident{openIncidents.length !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Active incidents */}
          {openIncidents.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse inline-block" />
                Active Incidents ({openIncidents.length})
              </h2>
              {openIncidents.map((inc) => {
                const key = `${inc.pipeline_id}:${inc.branch}`;
                const isExp = expanded === key;
                return (
                  <Card key={key} className="border-destructive/30">
                    <CardContent className="p-4">
                      <button className="w-full text-left" onClick={() => setExpanded(isExp ? null : key)}>
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{inc.repo_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <GitBranch className="w-3 h-3" /><span>{inc.branch}</span>
                              <span>·</span>
                              <Clock className="w-3 h-3" />
                              <span>Started {fmtDate(inc.failureStart)}</span>
                              <span>·</span>
                              <span className="text-destructive font-medium">{inc.runs.length} failure{inc.runs.length !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                          {isExp ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {isExp && (
                        <div className="mt-4 space-y-2 border-t border-border pt-3">
                          {inc.runs.map((run) => (
                            <RunCard key={run.id} run={run} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Resolved incidents */}
          {closedIncidents.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Resolved Incidents ({closedIncidents.length})
              </h2>
              {closedIncidents.map((inc) => {
                const key = `resolved:${inc.pipeline_id}:${inc.branch}:${inc.failureStart}`;
                const isExp = expanded === key;
                return (
                  <Card key={key}>
                    <CardContent className="p-4">
                      <button className="w-full text-left" onClick={() => setExpanded(isExp ? null : key)}>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{inc.repo_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <GitBranch className="w-3 h-3" /><span>{inc.branch}</span>
                              <span>·</span>
                              <span>{inc.runs.length} failure{inc.runs.length !== 1 ? "s" : ""}</span>
                              {inc.durationHours !== null && (
                                <>
                                  <span>·</span>
                                  <span className="text-success">MTTR: {inc.durationHours < 1 ? `${Math.round(inc.durationHours * 60)}m` : `${inc.durationHours.toFixed(1)}h`}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {isExp ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {isExp && (
                        <div className="mt-4 space-y-2 border-t border-border pt-3">
                          {inc.runs.map((run) => (
                            <RunCard key={run.id} run={run} />
                          ))}
                          <div className="flex items-center gap-2 text-xs text-success pt-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Recovered at {fmtDate(inc.recoveredAt)}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {incidents.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle2 className="w-12 h-12 text-success/40 mx-auto mb-3" />
                <p className="font-medium text-sm">No incidents detected</p>
                <p className="text-xs text-muted-foreground mt-1">Your pipelines are running clean.</p>
              </CardContent>
            </Card>
          )}

          {/* Critical Path Analysis */}
          {recentRuns.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-warning" /> Critical Path Analysis — Slowest Runs (last 30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {recentRuns.slice(0, 15).map((run) => {
                    const dur = run.duration_seconds ?? 0;
                    const maxDur = recentRuns[0]?.duration_seconds ?? 1;
                    const pct = Math.round((dur / maxDur) * 100);
                    return (
                      <div key={run.id} className="py-2.5 space-y-1">
                        <div className="flex items-center gap-3 text-xs">
                          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${run.status === "success" ? "bg-success" : "bg-destructive"}`} />
                          <span className="flex-1 truncate font-medium">{run.repo_name}</span>
                          <code className="text-muted-foreground">{run.branch ?? "—"}</code>
                          <span className="font-mono text-muted-foreground">{fmtDur(run.duration_seconds)}</span>
                        </div>
                        {/* Critical path job breakdown */}
                        {run.pipeline_jobs?.length > 0 && (
                          <div className="flex gap-1 ml-5 flex-wrap">
                            {run.pipeline_jobs.map((job) => {
                              const jDur = job.completed_at && job.started_at
                                ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                                : null;
                              return (
                                <div key={job.id} className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1
                                  ${job.status === "success" ? "bg-success/10 text-success" : job.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                                  <span className="truncate max-w-[100px]">{job.job_name}</span>
                                  {jDur && <span className="opacity-70">{fmtDur(jDur)}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="ml-5 h-1 bg-muted rounded overflow-hidden">
                          <div className={`h-full rounded ${run.status === "success" ? "bg-success/50" : "bg-destructive/50"}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function RunCard({ run }: { run: Run }) {
  return (
    <div className={`p-3 rounded-md text-xs ${run.status === "success" ? "bg-success/5 border border-success/20" : "bg-destructive/5 border border-destructive/20"}`}>
      <div className="flex items-center gap-2 mb-1">
        {run.status === "success"
          ? <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
          : <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
        <code className="text-muted-foreground truncate">{run.commit_sha?.slice(0, 8) ?? "—"}</code>
        <span className="flex-1 truncate text-muted-foreground">{run.commit_message?.slice(0, 60) ?? ""}</span>
        <span className="text-muted-foreground flex-shrink-0">{run.triggered_by ?? "—"}</span>
        <span className="text-muted-foreground flex-shrink-0">{fmtDur(run.duration_seconds)}</span>
      </div>
      {run.pipeline_jobs?.filter((j) => j.status === "failed").map((job) => (
        <div key={job.id} className="mt-1 text-destructive">
          <span className="font-medium">{job.job_name}:</span>{" "}
          <span className="opacity-80">{job.error_excerpt?.slice(0, 100) ?? "failed"}</span>
        </div>
      ))}
    </div>
  );
}
