"use client";

import { useState, useEffect, useCallback } from "react";
import { GitPullRequestDraft, Plus, Trash2, Loader2, ExternalLink, RefreshCw, CheckCircle2, XCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Pipeline = { id: string; repo_full_name: string; provider: string };
type AutoIssueRule = {
  id: string;
  pipeline_id: string;
  is_active: boolean;
  consecutive_failures: number;
  labels: string[];
  assignees: string[];
  created_at: string;
  pipelines: Pipeline | null;
};
type AutoIssue = {
  id: string;
  pipeline_id: string;
  github_issue_number: number | null;
  github_issue_url: string | null;
  title: string | null;
  status: string;
  created_at: string;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AutoIssuesPage() {
  const [rules, setRules] = useState<AutoIssueRule[]>([]);
  const [issues, setIssues] = useState<AutoIssue[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    pipeline_id: "", consecutive_failures: 3,
    labels: "ci-failure,automated", assignees: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, iRes, pRes] = await Promise.all([
      fetch("/api/auto-issue-rules"),
      fetch("/api/auto-issues"),
      fetch("/api/pipelines"),
    ]);
    if (rRes.ok) { const d = await rRes.json(); setRules(d.rules ?? []); }
    if (iRes.ok) { const d = await iRes.json(); setIssues(d.issues ?? []); }
    if (pRes.ok) { const d = await pRes.json(); setPipelines(d.pipelines ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createRule() {
    const res = await fetch("/api/auto-issue-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pipeline_id: form.pipeline_id,
        consecutive_failures: form.consecutive_failures,
        labels: form.labels.split(",").map((l) => l.trim()).filter(Boolean),
        assignees: form.assignees.split(",").map((a) => a.trim()).filter(Boolean),
      }),
    });
    if (res.ok) {
      setShowNew(false);
      setForm({ pipeline_id: "", consecutive_failures: 3, labels: "ci-failure,automated", assignees: "" });
      await load();
    }
  }

  async function toggleRule(id: string, is_active: boolean) {
    setActing(id);
    await fetch(`/api/auto-issue-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, is_active } : r));
    setActing(null);
  }

  async function deleteRule(id: string) {
    setActing(id + "del");
    await fetch(`/api/auto-issue-rules/${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
    setActing(null);
  }

  async function closeIssue(id: string) {
    setActing(id + "close");
    await fetch(`/api/auto-issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    setIssues((prev) => prev.map((i) => i.id === id ? { ...i, status: "closed" } : i));
    setActing(null);
  }

  const openIssues = issues.filter((i) => i.status === "open");

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitPullRequestDraft className="w-6 h-6 text-primary" /> Auto GitHub Issues
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automatically create GitHub issues when a pipeline fails N times in a row
          </p>
        </div>
        <div className="flex items-center gap-2">
          {openIssues.length > 0 && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/30">
              {openIssues.length} open issue{openIssues.length !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </Button>
        </div>
      </div>

      {/* New rule modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">New Auto-Issue Rule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Pipeline</label>
                <select value={form.pipeline_id} onChange={(e) => setForm({ ...form, pipeline_id: e.target.value })}
                  className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background">
                  <option value="">Select pipeline…</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.repo_full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Create issue after this many consecutive failures
                </label>
                <input type="number" min={1} max={20} value={form.consecutive_failures}
                  onChange={(e) => setForm({ ...form, consecutive_failures: parseInt(e.target.value) || 3 })}
                  className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Labels (comma-separated)</label>
                <input value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })}
                  placeholder="ci-failure,automated"
                  className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Assignees (comma-separated GitHub usernames)</label>
                <input value={form.assignees} onChange={(e) => setForm({ ...form, assignees: e.target.value })}
                  placeholder="octocat,hubot"
                  className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={createRule} disabled={!form.pipeline_id} className="flex-1">Create Rule</Button>
                <Button size="sm" variant="outline" onClick={() => setShowNew(false)} className="flex-1">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Rules */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Auto-Issue Rules</CardTitle></CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No rules yet. Click "Add Rule" to automatically open GitHub issues when a pipeline fails repeatedly.</p>
              ) : (
                <div className="divide-y divide-border">
                  {rules.map((rule) => (
                    <div key={rule.id} className="py-3 flex items-center gap-3">
                      <button onClick={() => toggleRule(rule.id, !rule.is_active)} disabled={acting === rule.id}
                        className={`flex-shrink-0 ${rule.is_active ? "text-primary" : "text-muted-foreground"}`}>
                        {acting === rule.id
                          ? <Loader2 className="w-5 h-5 animate-spin" />
                          : rule.is_active
                            ? <ToggleRight className="w-5 h-5" />
                            : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{rule.pipelines?.repo_full_name ?? rule.pipeline_id}</p>
                        <p className="text-xs text-muted-foreground">
                          Create issue after <strong>{rule.consecutive_failures}</strong> consecutive failures
                        </p>
                        {rule.labels.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {rule.labels.map((l) => (
                              <Badge key={l} variant="outline" className="text-xs py-0">{l}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge className={`text-xs flex-shrink-0 ${rule.is_active ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}`}>
                        {rule.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <button onClick={() => deleteRule(rule.id)} disabled={acting === rule.id + "del"}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0">
                        {acting === rule.id + "del"
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto-created issues log */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                Auto-Created Issues
                <span className="text-xs text-muted-foreground font-normal">{openIssues.length} open / {issues.length} total</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {issues.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No auto-created issues yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {issues.map((issue) => (
                    <div key={issue.id} className="py-3 flex items-start gap-3">
                      {issue.status === "open"
                        ? <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        : <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{issue.title ?? `Issue #${issue.github_issue_number}`}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(issue.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {issue.github_issue_url && (
                          <a href={issue.github_issue_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1 hover:underline">
                            <ExternalLink className="w-3 h-3" /> #{issue.github_issue_number}
                          </a>
                        )}
                        {issue.status === "open" && (
                          <Button size="sm" variant="outline"
                            className="h-6 text-xs px-2 text-success border-success/30 hover:bg-success/10"
                            disabled={acting === issue.id + "close"}
                            onClick={() => closeIssue(issue.id)}>
                            {acting === issue.id + "close" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Mark closed"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
