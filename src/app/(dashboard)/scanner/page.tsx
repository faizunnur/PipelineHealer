"use client";

import { useState, useEffect } from "react";
import {
  Shield, Play, Loader2, AlertTriangle, XCircle,
  Info, CheckCircle2, FileCode,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Finding = {
  id: string; rule_id: string; severity: string; title: string;
  description: string; recommendation: string; file_path: string;
  line_number: number | null; evidence: string | null; status: string;
};
type Pipeline = { id: string; repo_full_name: string; provider: string };

const SEV: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string; order: number }> = {
  critical: { icon: <XCircle       className="w-4 h-4" />, color: "text-destructive",    bg: "bg-destructive/5",  border: "border-destructive/40",  label: "Critical", order: 0 },
  high:     { icon: <AlertTriangle className="w-4 h-4" />, color: "text-orange-500",     bg: "bg-orange-500/5",   border: "border-orange-500/40",   label: "High",     order: 1 },
  medium:   { icon: <AlertTriangle className="w-4 h-4" />, color: "text-yellow-500",     bg: "bg-yellow-500/5",   border: "border-yellow-500/40",   label: "Medium",   order: 2 },
  low:      { icon: <Info          className="w-4 h-4" />, color: "text-blue-400",       bg: "bg-blue-500/5",     border: "border-blue-500/30",      label: "Low",      order: 3 },
  info:     { icon: <Info          className="w-4 h-4" />, color: "text-muted-foreground", bg: "bg-muted/30",    border: "border-border",            label: "Info",     order: 4 },
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

export default function ScannerPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selected, setSelected] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const open = findings.filter((f) => f.status === "open");
  const dismissed = findings.filter((f) => f.status !== "open");

  const counts = SEVERITY_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = open.filter((f) => f.severity === s).length;
    return acc;
  }, {});

  const bySeverity = SEVERITY_ORDER
    .map((s) => ({ severity: s, items: open.filter((f) => f.severity === s) }))
    .filter((g) => g.items.length > 0);

  const byFile = (items: Finding[]) =>
    Object.entries(
      items.reduce<Record<string, Finding[]>>((acc, f) => {
        acc[f.file_path] = acc[f.file_path] ?? [];
        acc[f.file_path].push(f);
        return acc;
      }, {})
    );

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

      {/* Controls */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <select
            value={selected}
            onChange={(e) => { setSelected(e.target.value); loadFindings(e.target.value); }}
            className="flex-1 min-w-[200px] h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.repo_full_name}</option>
            ))}
          </select>
          <Button onClick={runScan} disabled={!selected || scanning} className="gap-2">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {scanning ? "Scanning..." : "Run Security Scan"}
          </Button>
        </CardContent>
      </Card>

      {/* Score summary */}
      {findings.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {SEVERITY_ORDER.map((sev) => {
            const cfg = SEV[sev];
            const count = counts[sev];
            return (
              <Card key={sev} className={`${count > 0 ? `${cfg.bg} ${cfg.border} border` : ""}`}>
                <CardContent className="p-3 text-center">
                  <div className={`text-2xl font-bold ${count > 0 ? cfg.color : "text-muted-foreground"}`}>
                    {count}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{cfg.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!scanning && findings.length === 0 && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium">No scan results yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Run a scan to check your workflow files for security issues
            </p>
          </CardContent>
        </Card>
      )}

      {/* Findings grouped by severity then file */}
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

                <div className="space-y-3 pl-0">
                  {fileFindings.map((f) => (
                    <Card key={f.id} className={`border ${cfg.border} ${cfg.bg}`}>
                      <CardContent className="p-4 space-y-3">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-sm ${cfg.color}`}>{f.title}</span>
                            <Badge variant="secondary" className="text-xs font-mono">{f.rule_id}</Badge>
                            {f.line_number && (
                              <span className="text-xs text-muted-foreground">Line {f.line_number}</span>
                            )}
                          </div>
                          <button
                            onClick={() => dismissFinding(f.id)}
                            className="flex-shrink-0 text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>

                        {/* Evidence */}
                        {f.evidence && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Detected:</p>
                            <code className={`block text-xs font-mono px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive break-all`}>
                              {f.evidence}
                            </code>
                          </div>
                        )}

                        {/* Description */}
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {f.description}
                        </p>

                        {/* Recommendation */}
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <p className="text-xs font-semibold text-primary mb-1">How to fix</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {f.recommendation}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Dismissed findings */}
      {dismissed.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
            {dismissed.length} dismissed finding{dismissed.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-2 opacity-50">
            {dismissed.map((f) => {
              const cfg = SEV[f.severity] ?? SEV.info;
              return (
                <Card key={f.id} className="border border-border">
                  <CardContent className="p-3 flex items-center gap-2">
                    <span className={`${cfg.color}`}>{cfg.icon}</span>
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
              <p className="text-xs text-muted-foreground">
                Run another scan after making changes to verify.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
