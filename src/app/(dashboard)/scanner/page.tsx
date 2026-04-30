"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Shield, Play, Loader2, AlertTriangle, XCircle,
  Info, CheckCircle2, FileCode, Sparkles, Zap, X, Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type AiFixResult = {
  explanation: string;
  original_code: string | null;
  fixed_code: string | null;
  confidence: "high" | "medium" | "low";
};
type Finding = {
  id: string; rule_id: string; severity: string; title: string;
  description: string; recommendation: string; file_path: string;
  line_number: number | null; evidence: string | null; status: string;
  ai_fix_result: AiFixResult | null;
};
type Pipeline = { id: string; repo_full_name: string; provider: string };

const SEV: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string; order: number }> = {
  critical: { icon: <XCircle       className="w-4 h-4" />, color: "text-destructive",    bg: "bg-destructive/5",  border: "border-destructive/40",  label: "Critical", order: 0 },
  high:     { icon: <AlertTriangle className="w-4 h-4" />, color: "text-orange-500",     bg: "bg-orange-500/5",   border: "border-orange-500/40",   label: "High",     order: 1 },
  medium:   { icon: <AlertTriangle className="w-4 h-4" />, color: "text-yellow-500",     bg: "bg-yellow-500/5",   border: "border-yellow-500/40",   label: "Medium",   order: 2 },
  low:      { icon: <Info          className="w-4 h-4" />, color: "text-blue-400",       bg: "bg-blue-500/5",     border: "border-blue-500/30",      label: "Low",      order: 3 },
  info:     { icon: <Info          className="w-4 h-4" />, color: "text-muted-foreground", bg: "bg-muted/30",    border: "border-border",            label: "Info",     order: 4 },
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-success border-success/40 bg-success/5",
  medium: "text-yellow-500 border-yellow-500/40 bg-yellow-500/5",
  low: "text-muted-foreground border-border bg-muted/30",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

export default function ScannerPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selected, setSelected] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
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
        if (list[0]) { setSelected(list[0].id); loadFindings(list[0].id); }
        setLoading(false);
      });
  }, []);

  async function loadFindings(pipelineId: string) {
    const res = await fetch(`/api/scan/${pipelineId}`);
    const data = await res.json();
    setFindings(data.findings ?? []);
  }

  async function runScan() {
    if (!selected) return;
    setScanning(true);
    const res = await fetch(`/api/scan/${selected}`, { method: "POST" });
    const data = await res.json();
    setScanning(false);
    if (res.ok) {
      setFindings(data.findings ?? []);
      const critical = (data.findings ?? []).filter((f: Finding) => f.severity === "critical").length;
      toast({
        title: critical > 0
          ? `${critical} critical issue${critical !== 1 ? "s" : ""} found!`
          : `Scan complete — ${data.total ?? 0} issue${data.total !== 1 ? "s" : ""}`,
        variant: critical > 0 ? "destructive" : "default",
      });
    } else {
      toast({ title: "Scan failed", description: data.error, variant: "destructive" });
    }
  }

  async function dismissFinding(id: string) {
    await fetch(`/api/scan/${selected}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    setFindings((prev) => prev.map((f) => f.id === id ? { ...f, status: "dismissed" } : f));
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
      await fetch(`/api/scan/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: finding.id, ai_fix_result: result }),
      });
      setFindings((prev) => prev.map((f) => f.id === finding.id ? { ...f, ai_fix_result: result } : f));
    } finally {
      setAiFixLoading(null);
    }
  }

  async function dismissFix(finding: Finding) {
    await fetch(`/api/scan/${selected}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: finding.id, ai_fix_result: null }),
    });
    setFindings((prev) => prev.map((f) => f.id === finding.id ? { ...f, ai_fix_result: null } : f));
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
        body: JSON.stringify({ pipelineId: selected, findingId: finding.id, source: "security_scan" }),
      });
      const data = await res.json();
      if (res.ok) {
        setFindings((prev) => prev.map((f) => f.id === finding.id ? { ...f, status: "fixed" } : f));
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
      body: JSON.stringify({ pipelineId: selected, findingId: applyModal.finding.id, source: "security_scan" }),
    });
    const data = await res.json();
    if (res.ok) {
      setFindings((prev) => prev.map((f) => f.id === applyModal.finding!.id ? { ...f, status: "fixed" } : f));
      setApplyModal((s) => ({ ...s, applying: false, success: true }));
      toast({ title: "Fix applied!", description: "Committed to your repository." });
    } else {
      setApplyModal((s) => ({ ...s, applying: false, error: data.error }));
    }
  }

  const open = findings.filter((f) => f.status === "open");
  const dismissed = findings.filter((f) => f.status !== "open");

  // Apply search + severity filter to open findings
  const filteredOpen = useMemo(() => {
    const q = search.toLowerCase();
    return open.filter((f) => {
      if (sevFilter !== "all" && f.severity !== sevFilter) return false;
      if (q && !(
        f.title.toLowerCase().includes(q) ||
        f.rule_id.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.file_path.toLowerCase().includes(q) ||
        (f.evidence ?? "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [open, search, sevFilter]);

  const counts = SEVERITY_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = open.filter((f) => f.severity === s).length;
    return acc;
  }, {});

  const bySeverity = SEVERITY_ORDER
    .map((s) => ({ severity: s, items: filteredOpen.filter((f) => f.severity === s) }))
    .filter((g) => g.items.length > 0);

  const byFile = (items: Finding[]) =>
    Object.entries(items.reduce<Record<string, Finding[]>>((acc, f) => {
      acc[f.file_path] = acc[f.file_path] ?? [];
      acc[f.file_path].push(f);
      return acc;
    }, {}));

  const hasFilters = search || sevFilter !== "all";

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> Security Scanner
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Detect secrets, misconfigurations, and supply chain risks in your workflow files
        </p>
      </div>

      {/* Pipeline selector + scan button */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <select
            value={selected}
            onChange={(e) => { setSelected(e.target.value); loadFindings(e.target.value); }}
            className="flex-1 min-w-[200px] h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {pipelines.map((p) => (<option key={p.id} value={p.id}>{p.repo_full_name}</option>))}
          </select>
          <Button onClick={runScan} disabled={!selected || scanning} className="gap-2">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {scanning ? "Scanning..." : "Run Security Scan"}
          </Button>
        </CardContent>
      </Card>

      {/* Summary counts */}
      {findings.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {SEVERITY_ORDER.map((sev) => {
            const cfg = SEV[sev];
            const count = counts[sev];
            return (
              <button
                key={sev}
                onClick={() => setSevFilter(sevFilter === sev ? "all" : sev)}
                className={`rounded-lg border text-left transition-all ${
                  count > 0 ? `${cfg.bg} ${cfg.border}` : "border-border"
                } ${sevFilter === sev ? "ring-2 ring-primary ring-offset-1" : ""}`}
              >
                <div className="p-3 text-center">
                  <div className={`text-2xl font-bold ${count > 0 ? cfg.color : "text-muted-foreground"}`}>{count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{cfg.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Search + filter bar */}
      {findings.length > 0 && (
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

          {/* Severity quick-filter chips */}
          <div className="flex gap-1.5 flex-wrap">
            {(["all", ...SEVERITY_ORDER] as string[]).map((s) => (
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
      )}

      {/* Result count when filtering */}
      {hasFilters && findings.length > 0 && (
        <p className="text-xs text-muted-foreground -mt-2">
          Showing {filteredOpen.length} of {open.length} open findings
        </p>
      )}

      {!scanning && findings.length === 0 && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium">No scan results yet</p>
            <p className="text-sm text-muted-foreground mt-1">Run a scan to check your workflow files for security issues</p>
          </CardContent>
        </Card>
      )}

      {/* No results after filter */}
      {findings.length > 0 && filteredOpen.length === 0 && open.length > 0 && (
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
      )}

      {/* Findings grouped by severity → file */}
      {bySeverity.map(({ severity, items }) => {
        const cfg = SEV[severity];
        return (
          <div key={severity} className="space-y-4">
            <h2 className={`text-sm font-semibold uppercase tracking-wide flex items-center gap-2 ${cfg.color}`}>
              {cfg.icon} {cfg.label} — {items.length} finding{items.length !== 1 ? "s" : ""}
            </h2>

            {byFile(items).map(([filePath, fileFindings]) => (
              <div key={filePath}>
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{filePath}</code>
                </div>

                <div className="space-y-3">
                  {fileFindings.map((f) => {
                    const cfg2 = SEV[f.severity] ?? SEV.info;
                    const fix = f.ai_fix_result;
                    const isApplying = aiFixLoading === `apply-${f.id}`;
                    const isGenerating = aiFixLoading === f.id;
                    return (
                      <Card key={f.id} className={`border ${cfg2.border} ${cfg2.bg}`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold text-sm ${cfg2.color}`}>{f.title}</span>
                              <Badge variant="secondary" className="text-xs font-mono">{f.rule_id}</Badge>
                              {f.line_number && <span className="text-xs text-muted-foreground">Line {f.line_number}</span>}
                            </div>
                            <button
                              onClick={() => dismissFinding(f.id)}
                              className="flex-shrink-0 text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>

                          {f.evidence && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Detected:</p>
                              <code className="block text-xs font-mono px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive break-all">
                                {f.evidence}
                              </code>
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>

                          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                            <p className="text-xs font-semibold text-primary mb-1">How to fix</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{f.recommendation}</p>
                          </div>

                          <div className="flex items-center pt-1">
                            {!fix ? (
                              <button
                                onClick={() => handleAiFix(f)}
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
                          </div>

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
                                        onClick={() => setApplyModal({ open: true, finding: f, applying: false, error: null, success: false })}
                                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors"
                                      >
                                        <FileCode className="w-3 h-3" /> Manual Apply
                                      </button>
                                      <button
                                        onClick={() => handleAutoApply(f)}
                                        disabled={isApplying}
                                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                                      >
                                        {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                        Auto Apply
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => dismissFix(f)}
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
            ))}
          </div>
        );
      })}

      {/* Dismissed */}
      {dismissed.length > 0 && (
        <details>
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
            {dismissed.length} dismissed finding{dismissed.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-2 opacity-50">
            {dismissed.map((f) => {
              const cfg = SEV[f.severity] ?? SEV.info;
              return (
                <Card key={f.id} className="border border-border">
                  <CardContent className="p-3 flex items-center gap-2">
                    <span className={cfg.color}>{cfg.icon}</span>
                    <span className="text-xs font-medium flex-1">{f.title}</span>
                    <code className="text-xs text-muted-foreground">{f.file_path}</code>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </details>
      )}

      {open.length === 0 && findings.length > 0 && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-medium text-success">All issues resolved or dismissed</p>
              <p className="text-xs text-muted-foreground">Run another scan after making changes to verify.</p>
            </div>
          </CardContent>
        </Card>
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
