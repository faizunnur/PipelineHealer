"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck, Loader2, AlertTriangle, AlertCircle, Info,
  CheckCircle2, Play, FileCode,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

const SEV: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string; order: number }> = {
  critical: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-destructive",    bg: "bg-destructive/5",  border: "border-destructive/40",  label: "Critical", order: 0 },
  high:     { icon: <AlertCircle  className="w-4 h-4" />, color: "text-orange-500",     bg: "bg-orange-500/5",   border: "border-orange-500/40",   label: "High",     order: 1 },
  medium:   { icon: <AlertCircle  className="w-4 h-4" />, color: "text-yellow-500",     bg: "bg-yellow-500/5",   border: "border-yellow-500/40",   label: "Medium",   order: 2 },
  low:      { icon: <Info         className="w-4 h-4" />, color: "text-muted-foreground", bg: "bg-muted/30",      border: "border-border",           label: "Low",      order: 3 },
};

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
      // Use findings returned directly from scan — no separate GET needed
      if (d.findings && d.findings.length > 0) {
        setFindings(sortFindings(d.findings));
      } else if (d.totalFindings === 0) {
        setFindings([]);
      } else {
        // Fallback: load from DB in case insert returned empty
        await loadFindings(selectedPipeline);
      }
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

  const pipeline = pipelines.find((p) => p.id === selectedPipeline);
  const activeFindings = findings.filter((f) => !f.resolved);
  const resolvedFindings = findings.filter((f) => f.resolved);
  const displayed = showResolved ? findings : activeFindings;

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

      {/* Summary counts */}
      {findings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["critical", "high", "medium", "low"] as const).map((sev) => {
            const cfg = SEV[sev];
            return (
              <Card key={sev} className={`${cfg.bg} ${cfg.border} border`}>
                <CardContent className="p-4 text-center">
                  <div className={`text-3xl font-bold ${cfg.color}`}>{counts[sev]}</div>
                  <div className={`text-xs font-semibold mt-0.5 ${cfg.color}`}>{cfg.label}</div>
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
        <div className="space-y-4">
          {/* Header */}
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

          {/* Group by file */}
          {Object.entries(
            displayed.reduce<Record<string, Finding[]>>((acc, f) => {
              acc[f.file_path] = acc[f.file_path] ?? [];
              acc[f.file_path].push(f);
              return acc;
            }, {})
          ).map(([filePath, fileFindings]) => (
            <div key={filePath}>
              {/* File header */}
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <FileCode className="w-4 h-4 text-primary flex-shrink-0" />
                <code className="text-xs bg-muted px-2 py-0.5 rounded">{filePath}</code>
                <span className="text-xs text-muted-foreground">
                  {fileFindings.length} finding{fileFindings.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-3 pl-0">
                {fileFindings.map((finding) => {
                  const cfg = SEV[finding.severity] ?? SEV.low;
                  return (
                    <Card key={finding.id}
                      className={`${cfg.border} border ${finding.resolved ? "opacity-55" : ""}`}>
                      <CardContent className="p-4 space-y-3">
                        {/* Top row: severity + rule + line */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          <Badge variant="outline" className="text-xs font-mono">{finding.rule}</Badge>
                          {finding.line_number && (
                            <span className="text-xs text-muted-foreground">
                              Line {finding.line_number}
                            </span>
                          )}
                          {finding.resolved && (
                            <Badge variant="success" className="text-xs gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Resolved
                            </Badge>
                          )}
                        </div>

                        {/* Title */}
                        <p className="font-semibold text-sm">{finding.title}</p>

                        {/* Evidence */}
                        {finding.evidence && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Found:</p>
                            <code className={`block text-xs font-mono px-3 py-2 rounded-md border ${cfg.bg} ${cfg.border} truncate`}>
                              {finding.evidence}
                            </code>
                          </div>
                        )}

                        {/* Description */}
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {finding.description}
                        </p>

                        {/* Recommendation */}
                        <div className="p-3 bg-success/5 border border-success/20 rounded-lg">
                          <p className="text-xs font-semibold text-success mb-1">How to fix</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {finding.recommendation}
                          </p>
                        </div>

                        {/* Action */}
                        <div className="flex items-center justify-end pt-1">
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
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {activeFindings.length === 0 && !showResolved && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-success">All findings resolved</p>
                  <p className="text-xs text-muted-foreground">
                    Run another audit after making changes to verify.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
