"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck, Loader2, AlertTriangle, AlertCircle, Info,
  CheckCircle2, Play, FileCode, Sparkles, Zap, X, Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type Pipeline = { id: string; repo_full_name: string; provider: string };
type AiFixResult = {
  explanation: string;
  original_code: string | null;
  fixed_code: string | null;
  confidence: "high" | "medium" | "low";
};
type Finding = {
  id: string; file_path: string; severity: string; rule: string;
  title: string; description: string; evidence: string;
  line_number: number | null; recommendation: string;
  resolved: boolean; resolved_at: string | null;
  ai_fix_result: AiFixResult | null;
};

const SEV: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string; order: number }> = {
  critical: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-destructive",    bg: "bg-destructive/5",  border: "border-destructive/40",  label: "Critical", order: 0 },
  high:     { icon: <AlertCircle  className="w-4 h-4" />, color: "text-orange-500",     bg: "bg-orange-500/5",   border: "border-orange-500/40",   label: "High",     order: 1 },
  medium:   { icon: <AlertCircle  className="w-4 h-4" />, color: "text-yellow-500",     bg: "bg-yellow-500/5",   border: "border-yellow-500/40",   label: "Medium",   order: 2 },
  low:      { icon: <Info         className="w-4 h-4" />, color: "text-muted-foreground", bg: "bg-muted/30",      border: "border-border",           label: "Low",      order: 3 },
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-success border-success/40 bg-success/5",
  medium: "text-yellow-500 border-yellow-500/40 bg-yellow-500/5",
  low: "text-muted-foreground border-border bg-muted/30",
};

const SEVERITY_OPTS = ["all", "critical", "high", "medium", "low"];

function sortFindings(list: Finding[]) {
  return [...list].sort((a, b) => (SEV[a.severity]?.order ?? 99) - (SEV[b.severity]?.order ?? 99));
}

export default function EnvAuditPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [aiFixLoading, setAiFixLoading] = useState<string | null>(null);

  // Search & filter
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("all");

  const [applyModal, setApplyModal] = useState<{
    open: boolean; finding: Finding | null; applying: boolean; error: string | null; success: boolean;
  }>({ open: false, finding: null, applying: false, error: null, success: false });

  useEffect(() => {
    fetch("/api/pipelines")
      .then((r) => r.json())
      .then(({ pipelines: data }) => {
        const list = (data ?? []) as Pipeline[];
        setPipelines(list);
        if (list[0]) {
          setSelectedPipeline(list[0].id);
          loadFindings(list[0].id);
        }
        setLoading(false);
      });
  }, []);

  async function loadFindings(pipelineId: string) {
    const res = await fetch(`/api/env-audit/${pipelineId}`);
    const data = await res.json();
    setFindings(sortFindings(data.findings ?? []));
  }

  async function handleScan() {
    if (!selectedPipeline) return;
    setScanning(true);
    const res = await fetch(`/api/env-audit/${selectedPipeline}`, { method: "POST" });
    setScanning(false);
    if (res.ok) {
      const d = await res.json();
      if (d.findings && d.findings.length > 0) setFindings(sortFindings(d.findings));
      else if (d.totalFindings === 0) setFindings([]);
      else await loadFindings(selectedPipeline);
      toast({
        title: `Scan complete — ${d.totalFindings} finding${d.totalFindings !== 1 ? "s" : ""}`,
        description: [
          d.critical > 0 && `${d.critical} critical`,
          d.high > 0 && `${d.high} high`,
          d.medium > 0 && `${d.medium} medium`,
          d.low > 0 && `${d.low} low`,
        ].filter(Boolean).join(", ") || "No issues found",
      });
    } else {
      const d = await res.json();
      toast({ title: "Scan failed", description: d.error, variant: "destructive" });
    }
  }

  async function handleAiFix(finding: Finding) {
    setAiFixLoading(finding.id);
    try {
      const res = await fetch("/api/ai-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finding }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ title: "AI fix failed", description: result.error, variant: "destructive" });
        return;
      }
      await fetch(`/api/env-audit/${selectedPipeline}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingId: finding.id, ai_fix_result: result }),
      });
      setFindings((prev) =>
        prev.map((f) => f.id === finding.id ? { ...f, ai_fix_result: result } : f)
      );
    } finally {
      setAiFixLoading(null);
    }
  }

  async function dismissFix(finding: Finding) {
    await fetch(`/api/env-audit/${selectedPipeline}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ findingId: finding.id, ai_fix_result: null }),
    });
    setFindings((prev) => prev.map((f) => f.id === finding.id ? { ...f, ai_fix_result: null } : f));
  }

  async function toggleResolved(finding: Finding) {
    const res = await fetch(`/api/env-audit/${selectedPipeline}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ findingId: finding.id, resolved: !finding.resolved }),
    });
    if (res.ok) {
      setFindings((prev) =>
        prev.map((f) => f.id === finding.id ? { ...f, resolved: !f.resolved } : f)
      );
    }
  }

  async function handleAutoApply(finding: Finding) {
    if (!finding.ai_fix_result?.original_code) {
      toast({ title: "Cannot auto-apply", description: "No exact code fix available. Use Manual Apply to review.", variant: "destructive" });
      return;
    }
    setAiFixLoading(`apply-${finding.id}`);
    try {
      const res = await fetch("/api/ai-fix/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId: selectedPipeline, findingId: finding.id, source: "env_audit" }),
      });
      const data = await res.json();
      if (res.ok) {
        setFindings((prev) => prev.map((f) => f.id === finding.id ? { ...f, resolved: true } : f));
        toast({ title: "Fix applied!", description: "Committed to your repository." });
      } else {
        toast({ title: "Apply failed", description: data.error, variant: "destructive" });
      }
    } finally {
      setAiFixLoading(null);
    }
  }

  async function commitManualApply() {
    if (!applyModal.finding) return;
    setApplyModal((s) => ({ ...s, applying: true, error: null }));
    const res = await fetch("/api/ai-fix/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineId: selectedPipeline, findingId: applyModal.finding.id, source: "env_audit" }),
    });
    const data = await res.json();
    if (res.ok) {
      setFindings((prev) => prev.map((f) => f.id === applyModal.finding!.id ? { ...f, resolved: true } : f));
      setApplyModal((s) => ({ ...s, applying: false, success: true }));
      toast({ title: "Fix applied!", description: "Committed to your repository." });
    } else {
      setApplyModal((s) => ({ ...s, applying: false, error: data.error }));
    }
  }

  const pipeline = pipelines.find((p) => p.id === selectedPipeline);
  const activeFindings = findings.filter((f) => !f.resolved);
  const resolvedFindings = findings.filter((f) => f.resolved);
  const base = showResolved ? findings : activeFindings;

  // Apply search + severity filter
  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    return base.filter((f) => {
      if (sevFilter !== "all" && f.severity !== sevFilter) return false;
      if (q && !(
        f.title.toLowerCase().includes(q) ||
        f.rule.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.file_path.toLowerCase().includes(q) ||
        (f.evidence ?? "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [base, search, sevFilter]);

  const hasFilters = search || sevFilter !== "all";

  const counts = {
    critical: activeFindings.filter((f) => f.severity === "critical").length,
    high:     activeFindings.filter((f) => f.severity === "high").length,
    medium:   activeFindings.filter((f) => f.severity === "medium").length,
    low:      activeFindings.filter((f) => f.severity === "low").length,
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> Env Variable & Secret Audit
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Scan workflow files for hardcoded secrets and misconfigurations
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label>Pipeline</Label>
            <select
              value={selectedPipeline}
              onChange={(e) => { setSelectedPipeline(e.target.value); loadFindings(e.target.value); }}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.repo_full_name}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleScan} disabled={scanning || !selectedPipeline} className="gap-2 h-10">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {scanning ? "Scanning..." : "Run Audit"}
          </Button>
        </CardContent>
      </Card>

      {/* Summary counts — clickable severity filters */}
      {findings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["critical", "high", "medium", "low"] as const).map((sev) => {
            const cfg = SEV[sev];
            return (
              <button
                key={sev}
                onClick={() => setSevFilter(sevFilter === sev ? "all" : sev)}
                className={`rounded-lg border text-left transition-all ${cfg.bg} ${cfg.border} ${
                  sevFilter === sev ? "ring-2 ring-primary ring-offset-1" : ""
                }`}
              >
                <div className="p-4 text-center">
                  <div className={`text-3xl font-bold ${cfg.color}`}>{counts[sev]}</div>
                  <div className={`text-xs font-semibold mt-0.5 ${cfg.color}`}>{cfg.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Findings list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : findings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium">No audit results yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {pipeline?.provider === "github"
                ? "Click \"Run Audit\" to scan your workflow files"
                : "Env audit currently supports GitHub repositories"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Header row: count + show resolved toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {activeFindings.length} active finding{activeFindings.length !== 1 ? "s" : ""}
              {resolvedFindings.length > 0 && ` · ${resolvedFindings.length} resolved`}
            </p>
            {resolvedFindings.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7"
                onClick={() => setShowResolved(!showResolved)}>
                {showResolved ? "Hide resolved" : "Show resolved"}
              </Button>
            )}
          </div>

          {/* Search + severity filter */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search findings…"
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {SEVERITY_OPTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSevFilter(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                    sevFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setSevFilter("all"); }}
                className="h-9 text-xs gap-1 text-muted-foreground flex-shrink-0"
              >
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>

          {hasFilters && (
            <p className="text-xs text-muted-foreground -mt-2">
              Showing {displayed.length} of {base.length} findings
            </p>
          )}

          {displayed.length === 0 && base.length > 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No findings match your search</p>
                <button
                  onClick={() => { setSearch(""); setSevFilter("all"); }}
                  className="text-xs text-primary hover:underline mt-1.5"
                >
                  Clear filters
                </button>
              </CardContent>
            </Card>
          ) : (
            Object.entries(
              displayed.reduce<Record<string, Finding[]>>((acc, f) => {
                acc[f.file_path] = acc[f.file_path] ?? [];
                acc[f.file_path].push(f);
                return acc;
              }, {})
            ).map(([filePath, fileFindings]) => (
              <div key={filePath}>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <FileCode className="w-4 h-4 text-primary flex-shrink-0" />
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{filePath}</code>
                  <span className="text-xs text-muted-foreground">{fileFindings.length} finding{fileFindings.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="space-y-3">
                  {fileFindings.map((finding) => {
                    const cfg = SEV[finding.severity] ?? SEV.low;
                    const fix = finding.ai_fix_result;
                    const isApplying = aiFixLoading === `apply-${finding.id}`;
                    const isGenerating = aiFixLoading === finding.id;
                    return (
                      <Card key={finding.id} className={`${cfg.border} border ${finding.resolved ? "opacity-55" : ""}`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                            <Badge variant="outline" className="text-xs font-mono">{finding.rule}</Badge>
                            {finding.line_number && <span className="text-xs text-muted-foreground">Line {finding.line_number}</span>}
                            {finding.resolved && (
                              <Badge variant="success" className="text-xs gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Resolved
                              </Badge>
                            )}
                          </div>

                          <p className="font-semibold text-sm">{finding.title}</p>

                          {finding.evidence && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Found:</p>
                              <code className={`block text-xs font-mono px-3 py-2 rounded-md border ${cfg.bg} ${cfg.border} truncate`}>
                                {finding.evidence}
                              </code>
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground leading-relaxed">{finding.description}</p>

                          <div className="p-3 bg-success/5 border border-success/20 rounded-lg">
                            <p className="text-xs font-semibold text-success mb-1">How to fix</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{finding.recommendation}</p>
                          </div>

                          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                            {!fix ? (
                              <button
                                onClick={() => handleAiFix(finding)}
                                disabled={isGenerating}
                                className="flex items-center gap-1 text-xs px-3 py-1 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                              >
                                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                Fix with AI
                              </button>
                            ) : (
                              <span className="text-xs text-primary flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> AI fix ready
                              </span>
                            )}
                            <button
                              onClick={() => toggleResolved(finding)}
                              className={`text-xs px-3 py-1 rounded-md border transition-colors ${
                                finding.resolved
                                  ? "border-border text-muted-foreground hover:text-foreground"
                                  : "border-success/30 text-success hover:bg-success/10"
                              }`}
                            >
                              {finding.resolved ? "Mark as active" : "Mark as resolved"}
                            </button>
                          </div>

                          {/* AI Fix Panel */}
                          {fix && (
                            <div className="border border-primary/20 rounded-lg overflow-hidden">
                              <div className="px-3 py-2 bg-primary/5 border-b border-primary/20 flex items-center justify-between">
                                <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                                  <Sparkles className="w-3 h-3" /> AI-Generated Fix
                                </span>
                                <Badge variant="outline" className={`text-[10px] ${CONFIDENCE_COLOR[fix.confidence]}`}>
                                  {fix.confidence} confidence
                                </Badge>
                              </div>
                              <div className="p-3 space-y-3">
                                <p className="text-xs text-muted-foreground leading-relaxed">{fix.explanation}</p>

                                {fix.original_code && fix.fixed_code ? (
                                  <div className="space-y-1.5">
                                    <div className="rounded-md overflow-hidden border border-destructive/20">
                                      <div className="px-2.5 py-1 bg-destructive/10 text-[10px] font-semibold text-destructive/80 uppercase tracking-wide">Before</div>
                                      <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-destructive/5 text-foreground max-h-40">{fix.original_code}</pre>
                                    </div>
                                    <div className="rounded-md overflow-hidden border border-success/20">
                                      <div className="px-2.5 py-1 bg-success/10 text-[10px] font-semibold text-success/80 uppercase tracking-wide">After</div>
                                      <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-success/5 text-foreground max-h-40">{fix.fixed_code}</pre>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">
                                    Exact code snippet could not be determined. Apply the recommendation manually.
                                  </p>
                                )}

                                <div className="flex items-center gap-2 flex-wrap pt-1">
                                  {fix.original_code && fix.fixed_code && (
                                    <>
                                      <button
                                        onClick={() => setApplyModal({ open: true, finding, applying: false, error: null, success: false })}
                                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors"
                                      >
                                        <FileCode className="w-3 h-3" /> Manual Apply
                                      </button>
                                      <button
                                        onClick={() => handleAutoApply(finding)}
                                        disabled={isApplying}
                                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                                      >
                                        {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                        Auto Apply
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => dismissFix(finding)}
                                    className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <X className="w-3 h-3" /> Dismiss Fix
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {activeFindings.length === 0 && !showResolved && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-success">All findings resolved</p>
                  <p className="text-xs text-muted-foreground">Run another audit after making changes to verify.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Manual Apply Modal */}
      <Dialog open={applyModal.open} onOpenChange={(o) => !applyModal.applying && setApplyModal((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="w-4 h-4" /> Review & Apply Fix
            </DialogTitle>
          </DialogHeader>

          {applyModal.finding && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <code className="bg-muted px-2 py-0.5 rounded">{applyModal.finding.file_path}</code>
                {applyModal.finding.line_number && <span>Line {applyModal.finding.line_number}</span>}
                <Badge variant="outline" className={`text-[10px] ${CONFIDENCE_COLOR[applyModal.finding.ai_fix_result?.confidence ?? "low"]}`}>
                  {applyModal.finding.ai_fix_result?.confidence} confidence
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">{applyModal.finding.ai_fix_result?.explanation}</p>

              <div className="space-y-1.5">
                <div className="rounded-md overflow-hidden border border-destructive/20">
                  <div className="px-2.5 py-1 bg-destructive/10 text-[10px] font-semibold text-destructive/80 uppercase tracking-wide">Before (will be replaced)</div>
                  <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap bg-destructive/5 text-foreground overflow-x-auto max-h-48">
                    {applyModal.finding.ai_fix_result?.original_code}
                  </pre>
                </div>
                <div className="rounded-md overflow-hidden border border-success/20">
                  <div className="px-2.5 py-1 bg-success/10 text-[10px] font-semibold text-success/80 uppercase tracking-wide">After (replacement)</div>
                  <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap bg-success/5 text-foreground overflow-x-auto max-h-48">
                    {applyModal.finding.ai_fix_result?.fixed_code}
                  </pre>
                </div>
              </div>

              {applyModal.error && (
                <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 px-3 py-2 rounded-md">
                  {applyModal.error}
                </p>
              )}
              {applyModal.success && (
                <p className="text-xs text-success bg-success/5 border border-success/20 px-3 py-2 rounded-md flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fix committed to repository successfully.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyModal((s) => ({ ...s, open: false }))} disabled={applyModal.applying}>
              {applyModal.success ? "Close" : "Cancel"}
            </Button>
            {!applyModal.success && (
              <Button onClick={commitManualApply} disabled={applyModal.applying} className="gap-2">
                {applyModal.applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Commit to Repository
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
