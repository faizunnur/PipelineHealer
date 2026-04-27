"use client";

import { useState, useEffect } from "react";
import {
  Shield, Play, Loader2, AlertTriangle, CheckCircle2,
  XCircle, Info, Eye, EyeOff, ChevronDown, ChevronUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Finding = {
  id: string; rule_id: string; severity: string; title: string;
  description: string; recommendation: string; file_path: string;
  line_number: number | null; evidence: string | null; status: string;
};

type Pipeline = { id: string; repo_full_name: string; provider: string };

const SEVERITY_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  critical: { icon: <XCircle className="w-4 h-4" />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "Critical" },
  high: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", label: "High" },
  medium: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", label: "Medium" },
  low: { icon: <Info className="w-4 h-4" />, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", label: "Low" },
  info: { icon: <Info className="w-4 h-4" />, color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/30", label: "Info" },
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

export default function ScannerPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selected, setSelected] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
      const critical = data.findings.filter((f: Finding) => f.severity === "critical").length;
      toast({
        title: critical > 0 ? `⚠️ ${critical} critical issue${critical !== 1 ? "s" : ""} found!` : `Scan complete: ${data.total} issue${data.total !== 1 ? "s" : ""}`,
        variant: critical > 0 ? "destructive" : "default",
      });
    } else {
      toast({ title: "Scan failed", description: data.error, variant: "destructive" });
    }
  }

  async function dismissFinding(id: string) {
    await fetch(`/api/scan/${selected}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    setFindings((prev) => prev.filter((f) => f.id !== id));
  }

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const open = findings.filter((f) => f.status === "open");
  const bySeverity = SEVERITY_ORDER.map((s) => ({
    severity: s,
    items: open.filter((f) => f.severity === s),
  })).filter((g) => g.items.length > 0);

  const scoreColor = open.some((f) => f.severity === "critical") ? "text-destructive" :
    open.some((f) => f.severity === "high") ? "text-orange-400" :
    open.some((f) => f.severity === "medium") ? "text-yellow-400" : "text-success";

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
          <select value={selected}
            onChange={(e) => { setSelected(e.target.value); loadFindings(e.target.value); }}
            className="flex-1 min-w-[200px] h-10 rounded-md border border-input bg-background px-3 text-sm">
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.repo_full_name}</option>
            ))}
          </select>
          <Button onClick={runScan} disabled={!selected || scanning}>
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {scanning ? "Scanning..." : "Run Security Scan"}
          </Button>
        </CardContent>
      </Card>

      {/* Score summary */}
      {findings.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {SEVERITY_ORDER.map((sev) => {
            const count = open.filter((f) => f.severity === sev).length;
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <Card key={sev} className={count > 0 ? cfg.bg : ""}>
                <CardContent className="p-3 text-center">
                  <div className={`text-2xl font-bold ${count > 0 ? cfg.color : "text-muted-foreground"}`}>{count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{cfg.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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

      {/* Findings grouped by severity */}
      {bySeverity.map(({ severity, items }) => {
        const cfg = SEVERITY_CONFIG[severity];
        return (
          <div key={severity}>
            <h2 className={`text-sm font-semibold uppercase tracking-wide mb-2 flex items-center gap-2 ${cfg.color}`}>
              {cfg.icon} {cfg.label} ({items.length})
            </h2>
            <div className="space-y-2">
              {items.map((f) => {
                const isExp = expanded.has(f.id);
                return (
                  <Card key={f.id} className={`border ${cfg.bg}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 mt-0.5 ${cfg.color}`}>{cfg.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{f.title}</span>
                            <Badge variant="secondary" className="text-xs font-mono">{f.rule_id}</Badge>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {f.file_path}{f.line_number ? `:${f.line_number}` : ""}
                            </code>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
                          {f.evidence && (
                            <code className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded mt-1 inline-block">
                              {f.evidence}
                            </code>
                          )}
                          <button onClick={() => toggle(f.id)}
                            className="text-xs text-primary hover:underline mt-2 flex items-center gap-1">
                            {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {isExp ? "Hide" : "Show"} recommendation
                          </button>
                          {isExp && (
                            <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs">
                              <p className="font-medium text-primary mb-1">How to fix:</p>
                              <p className="text-muted-foreground">{f.recommendation}</p>
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2 flex-shrink-0"
                          onClick={() => dismissFinding(f.id)}>
                          Dismiss
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

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
    </div>
  );
}
