"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Loader2, AlertTriangle, AlertCircle, Info, CheckCircle2, Play, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Pipeline = { id: string; repo_full_name: string; provider: string };
type Finding = {
  id: string; file_path: string; severity: string; rule: string;
  title: string; description: string; evidence: string;
  line_number: number | null; recommendation: string;
  resolved: boolean; resolved_at: string | null;
};

const SEVERITY_CONFIG: Record<string, {
  icon: React.ReactNode; color: string; bg: string; border: string; label: string; order: number;
}> = {
  critical: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", label: "Critical", order: 0 },
  high: { icon: <AlertCircle className="w-4 h-4" />, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30", label: "High", order: 1 },
  medium: { icon: <AlertCircle className="w-4 h-4" />, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", label: "Medium", order: 2 },
  low: { icon: <Info className="w-4 h-4" />, color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", label: "Low", order: 3 },
};

export default function EnvAuditPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showResolved, setShowResolved] = useState(false);

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
    const sorted = (data.findings ?? []).sort((a: Finding, b: Finding) => {
      const ao = SEVERITY_CONFIG[a.severity]?.order ?? 99;
      const bo = SEVERITY_CONFIG[b.severity]?.order ?? 99;
      return ao - bo;
    });
    setFindings(sorted);
  }

  async function handleScan() {
    if (!selectedPipeline) return;
    setScanning(true);
    const res = await fetch(`/api/env-audit/${selectedPipeline}`, { method: "POST" });
    setScanning(false);
    if (res.ok) {
      const d = await res.json();
      toast({
        title: `Scan complete — ${d.totalFindings} findings`,
        description: `${d.critical} critical, ${d.high} high, ${d.medium} medium, ${d.low} low`,
      });
      loadFindings(selectedPipeline);
    } else {
      const d = await res.json();
      toast({ title: "Scan failed", description: d.error, variant: "destructive" });
    }
  }

  async function toggleResolved(finding: Finding) {
    const res = await fetch(`/api/env-audit/${selectedPipeline}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ findingId: finding.id, resolved: !finding.resolved }),
    });
    if (res.ok) {
      setFindings((prev) => prev.map((f) =>
        f.id === finding.id ? { ...f, resolved: !f.resolved } : f));
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const pipeline = pipelines.find((p) => p.id === selectedPipeline);
  const activeFindings = findings.filter((f) => !f.resolved);
  const resolvedFindings = findings.filter((f) => f.resolved);
  const displayed = showResolved ? findings : activeFindings;

  const counts = {
    critical: activeFindings.filter((f) => f.severity === "critical").length,
    high: activeFindings.filter((f) => f.severity === "high").length,
    medium: activeFindings.filter((f) => f.severity === "medium").length,
    low: activeFindings.filter((f) => f.severity === "low").length,
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> Env Variable & Secret Audit
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Scan workflow files for hardcoded secrets and misconfigurations
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label>Pipeline</Label>
            <select value={selectedPipeline}
              onChange={(e) => { setSelectedPipeline(e.target.value); loadFindings(e.target.value); }}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
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

      {/* Summary cards */}
      {findings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["critical", "high", "medium", "low"] as const).map((sev) => {
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <Card key={sev} className={`${cfg.bg} ${cfg.border} border`}>
                <CardContent className="p-4 text-center">
                  <div className={`text-2xl font-bold ${cfg.color}`}>{counts[sev]}</div>
                  <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Findings list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {activeFindings.length} active finding{activeFindings.length !== 1 ? "s" : ""}
              {resolvedFindings.length > 0 && ` · ${resolvedFindings.length} resolved`}
            </p>
            {resolvedFindings.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowResolved(!showResolved)}>
                {showResolved ? "Hide resolved" : "Show resolved"}
              </Button>
            )}
          </div>

          {displayed.map((finding) => {
            const cfg = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.low;
            const isExp = expanded.has(finding.id);
            return (
              <Card key={finding.id}
                className={`${finding.resolved ? "opacity-60" : ""} ${cfg.border} border transition-opacity`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 mt-0.5 ${cfg.color}`}>{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                        <code className="text-xs bg-muted px-1 rounded">{finding.rule}</code>
                        <span className="text-xs text-muted-foreground">{finding.file_path}
                          {finding.line_number ? `:${finding.line_number}` : ""}
                        </span>
                        {finding.resolved && (
                          <Badge variant="success" className="text-xs gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium">{finding.title}</p>
                      <code className="block mt-1 text-xs font-mono bg-muted/50 px-2 py-1 rounded truncate">
                        {finding.evidence}
                      </code>

                      {isExp && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-muted-foreground">{finding.description}</p>
                          <div className="p-2 bg-success/10 border border-success/20 rounded text-xs">
                            <span className="font-medium text-success">Recommendation: </span>
                            {finding.recommendation}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => toggleExpand(finding.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExp ? "Less" : "More details"}
                        </button>
                        <button onClick={() => toggleResolved(finding)}
                          className={`text-xs transition-colors ${finding.resolved ? "text-muted-foreground hover:text-foreground" : "text-success hover:text-success/80"}`}>
                          {finding.resolved ? "Mark as active" : "Mark as resolved"}
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
