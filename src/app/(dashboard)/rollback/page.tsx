"use client";

import { useState, useEffect } from "react";
import { RotateCcw, Loader2, AlertTriangle, CheckCircle2, XCircle, GitCommit, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";

type Pipeline = { id: string; repo_full_name: string; provider: string };
type Run = { id: string; status: string; branch: string; created_at: string; commit_sha: string };
type Commit = { sha: string; message: string; date: string; author: string };
type RollbackEvent = {
  id: string; pipeline_id: string; run_id: string; target_sha: string;
  reason: string; status: string; result_sha: string | null; error: string | null;
  executed_at: string | null; created_at: string;
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  applied: { icon: <CheckCircle2 className="w-4 h-4" />, color: "text-success", label: "Applied" },
  success: { icon: <CheckCircle2 className="w-4 h-4" />, color: "text-success", label: "Success" },
  failed: { icon: <XCircle className="w-4 h-4" />, color: "text-destructive", label: "Failed" },
  pending: { icon: <Clock className="w-4 h-4" />, color: "text-warning", label: "Pending" },
  applying: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: "text-primary", label: "Applying" },
};

export default function RollbackPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedSha, setSelectedSha] = useState("");
  const [history, setHistory] = useState<RollbackEvent[]>([]);
  const [rolling, setRolling] = useState(false);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pipelines")
      .then((r) => r.json())
      .then(({ pipelines: data }) => {
        const list = (data ?? []) as Pipeline[];
        setPipelines(list);
        if (list[0]) {
          setSelectedPipeline(list[0].id);
          loadRuns(list[0].id);
          loadHistory(list[0].id);
        }
        setLoading(false);
      });
  }, []);

  async function loadRuns(pipelineId: string) {
    const res = await fetch(`/api/pipeline-runs?pipelineId=${pipelineId}`);
    const data = await res.json();
    setRuns(data.runs ?? []);
    setSelectedRun("");
    setCommits([]);
    setSelectedSha("");
  }

  async function loadHistory(pipelineId: string) {
    const res = await fetch(`/api/rollback?pipelineId=${pipelineId}`);
    const data = await res.json();
    setHistory(data.history ?? []);
  }

  async function loadCommits(runId: string) {
    setLoadingCommits(true);
    const res = await fetch(`/api/rollback?pipelineId=${selectedPipeline}&runId=${runId}`);
    const data = await res.json();
    setCommits(data.commits ?? []);
    if (data.commits?.[1]) setSelectedSha(data.commits[1].sha);
    setLoadingCommits(false);
  }

  async function handleRollback() {
    if (!selectedPipeline || !selectedRun || !selectedSha) return;
    setRolling(true);
    const res = await fetch("/api/rollback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pipelineId: selectedPipeline,
        runId: selectedRun,
        targetSha: selectedSha,
        reason: `Manual rollback to ${selectedSha.slice(0, 7)} via PipelineHealer`,
      }),
    });
    setRolling(false);
    if (res.ok) {
      const d = await res.json();
      toast({ title: `Rolled back successfully!`, description: `New commit: ${d.sha?.slice(0, 7)}` });
      loadHistory(selectedPipeline);
    } else {
      const d = await res.json();
      toast({ title: "Rollback failed", description: d.error, variant: "destructive" });
    }
  }

  function handlePipelineChange(pid: string) {
    setSelectedPipeline(pid);
    loadRuns(pid);
    loadHistory(pid);
  }

  function handleRunChange(rid: string) {
    setSelectedRun(rid);
    if (rid) loadCommits(rid);
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <RotateCcw className="w-6 h-6 text-primary" /> Rollback on Deploy Failure
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Instantly revert to a known-good commit when a deploy fails
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Trigger Rollback</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading pipelines...
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pipeline</Label>
                  <select value={selectedPipeline}
                    onChange={(e) => handlePipelineChange(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.repo_full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Failed Run</Label>
                  <select value={selectedRun}
                    onChange={(e) => handleRunChange(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select a run...</option>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.branch} · {r.status} · {formatRelativeTime(r.created_at)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedRun && (
                <div className="space-y-2">
                  <Label>Rollback Target</Label>
                  {loadingCommits ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading commits...
                    </div>
                  ) : commits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No commits available. GitHub repos only.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border border-input p-2">
                      {commits.map((c, i) => (
                        <label key={c.sha}
                          className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors ${selectedSha === c.sha ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}>
                          <input type="radio" name="sha" value={c.sha}
                            checked={selectedSha === c.sha}
                            onChange={() => setSelectedSha(c.sha)}
                            className="mt-0.5 accent-primary" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <GitCommit className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <code className="text-xs font-mono text-primary">{c.sha.slice(0, 7)}</code>
                              {i === 0 && <Badge variant="outline" className="text-xs">HEAD</Badge>}
                            </div>
                            <p className="text-xs mt-0.5 truncate">{c.message}</p>
                            <p className="text-xs text-muted-foreground">{c.author} · {formatRelativeTime(c.date)}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedSha && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium text-warning">This will create a new commit reverting to <code className="font-mono">{selectedSha.slice(0, 7)}</code>.</p>
                      <p className="text-muted-foreground mt-0.5">This is non-destructive — git history is preserved. The rollback creates a new commit on top.</p>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={handleRollback}
                disabled={!selectedPipeline || !selectedRun || !selectedSha || rolling}
                variant="destructive" className="gap-2">
                {rolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {rolling ? "Rolling back..." : "Execute Rollback"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold mb-3">Rollback History</h2>
        {history.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <RotateCcw className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-medium">No rollbacks yet</p>
              <p className="text-sm text-muted-foreground mt-1">Rollbacks triggered from this page will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.map((evt) => {
              const cfg = STATUS_CONFIG[evt.status] ?? STATUS_CONFIG.pending;
              return (
                <Card key={evt.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 ${cfg.color}`}>{cfg.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">Rollback to <code className="font-mono text-primary">{evt.target_sha.slice(0, 7)}</code></span>
                          <Badge variant={["applied", "success"].includes(evt.status) ? "success" : evt.status === "failed" ? "destructive" : "secondary"}
                            className="text-xs">{cfg.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{evt.reason}</p>
                        {evt.result_sha && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            New commit: <code className="font-mono text-success">{evt.result_sha.slice(0, 7)}</code>
                          </p>
                        )}
                        {evt.error && <p className="text-xs text-destructive mt-0.5">{evt.error}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {evt.executed_at ? formatRelativeTime(evt.executed_at) : formatRelativeTime(evt.created_at)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
