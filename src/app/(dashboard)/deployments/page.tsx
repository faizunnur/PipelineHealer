"use client";

import { useState, useEffect, useCallback } from "react";
import { Rocket, CheckCircle2, XCircle, Clock, AlertCircle, Plus, ChevronDown, Loader2, GitBranch, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Pipeline = { id: string; repo_full_name: string; provider: string; last_status: string | null };
type Deployment = {
  id: string;
  pipeline_id: string;
  environment: string;
  custom_env_name: string | null;
  status: string;
  version: string | null;
  deployed_at: string | null;
  deployed_by: string | null;
  approved_by: string | null;
  requires_approval: boolean;
  notes: string | null;
  created_at: string;
  pipelines: Pipeline | null;
};

const ENV_ORDER = ["dev", "staging", "production"] as const;
const ENV_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  dev:        { label: "Development", color: "text-blue-500",   bg: "bg-blue-500/10",   icon: <GitBranch className="w-4 h-4" /> },
  staging:    { label: "Staging",     color: "text-yellow-500", bg: "bg-yellow-500/10", icon: <Clock className="w-4 h-4" /> },
  production: { label: "Production",  color: "text-green-500",  bg: "bg-green-500/10",  icon: <Rocket className="w-4 h-4" /> },
};
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  deployed:         { label: "Deployed",         color: "text-success",      icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  pending_approval: { label: "Pending Approval", color: "text-yellow-500",   icon: <Clock className="w-3.5 h-3.5" /> },
  approved:         { label: "Approved",         color: "text-primary",      icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected:         { label: "Rejected",         color: "text-destructive",  icon: <XCircle className="w-3.5 h-3.5" /> },
  failed:           { label: "Failed",           color: "text-destructive",  icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // New deployment form
  const [form, setForm] = useState({
    pipeline_id: "", environment: "dev", custom_env_name: "",
    version: "", notes: "", requires_approval: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [dRes, pRes] = await Promise.all([
      fetch("/api/deployments"),
      fetch("/api/pipelines"),
    ]);
    if (dRes.ok) {
      const d = await dRes.json();
      setDeployments(d.deployments ?? []);
    }
    if (pRes.ok) {
      const p = await pRes.json();
      setPipelines(p.pipelines ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: string, action: string, notes?: string) {
    setActing(id + action);
    await fetch(`/api/deployments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes }),
    });
    await load();
    setActing(null);
  }

  async function createDeployment() {
    const body = { ...form, custom_env_name: form.environment === "custom" ? form.custom_env_name : undefined };
    const res = await fetch("/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowNew(false);
      setForm({ pipeline_id: "", environment: "dev", custom_env_name: "", version: "", notes: "", requires_approval: false });
      await load();
    }
  }

  // Group by environment
  const byEnv: Record<string, Deployment[]> = { dev: [], staging: [], production: [] };
  const custom: Deployment[] = [];
  for (const d of deployments) {
    if (d.environment in byEnv) byEnv[d.environment].push(d);
    else custom.push(d);
  }

  const pendingCount = deployments.filter((d) => d.status === "pending_approval").length;

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" /> Deployment Board
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track deployments across environments with optional approval gates
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
              {pendingCount} pending approval
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Deployment
          </Button>
        </div>
      </div>

      {/* New deployment modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">New Deployment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Pipeline</label>
                <select value={form.pipeline_id} onChange={(e) => setForm({ ...form, pipeline_id: e.target.value })}
                  className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background">
                  <option value="">Select pipeline…</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>{p.repo_full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Environment</label>
                <select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}
                  className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background">
                  <option value="dev">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {form.environment === "custom" && (
                <input placeholder="Custom environment name" value={form.custom_env_name}
                  onChange={(e) => setForm({ ...form, custom_env_name: e.target.value })}
                  className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background" />
              )}
              <input placeholder="Version / commit SHA (optional)" value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background" />
              <textarea placeholder="Notes (optional)" value={form.notes} rows={2}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background resize-none" />
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.requires_approval}
                  onChange={(e) => setForm({ ...form, requires_approval: e.target.checked })}
                  className="rounded" />
                Requires approval before deployment
              </label>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={createDeployment} disabled={!form.pipeline_id} className="flex-1">Create</Button>
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
          {/* Environment columns */}
          <div className="grid lg:grid-cols-3 gap-4">
            {ENV_ORDER.map((env) => {
              const cfg = ENV_CONFIG[env];
              const envDeps = byEnv[env];
              return (
                <div key={env} className="space-y-3">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg}`}>
                    <span className={cfg.color}>{cfg.icon}</span>
                    <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{envDeps.length} deployment{envDeps.length !== 1 ? "s" : ""}</span>
                  </div>

                  {envDeps.length === 0 ? (
                    <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
                      No deployments yet
                    </div>
                  ) : (
                    envDeps.map((dep) => {
                      const sc = STATUS_CONFIG[dep.status] ?? { label: dep.status, color: "text-muted-foreground", icon: null };
                      return (
                        <Card key={dep.id} className="text-sm">
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium text-xs truncate flex-1">
                                {dep.pipelines?.repo_full_name ?? dep.pipeline_id}
                              </span>
                              <span className={`flex items-center gap-1 text-xs flex-shrink-0 ${sc.color}`}>
                                {sc.icon} {sc.label}
                              </span>
                            </div>

                            {dep.version && (
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground block truncate">
                                {dep.version}
                              </code>
                            )}

                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {dep.deployed_at && <div>Deployed {fmtDate(dep.deployed_at)} by {dep.deployed_by}</div>}
                              {dep.approved_by && <div>Approved by {dep.approved_by}</div>}
                              {dep.notes && <div className="truncate italic">{dep.notes}</div>}
                            </div>

                            {dep.status === "pending_approval" && (
                              <div className="flex gap-1.5 pt-1">
                                <Button size="sm" variant="outline"
                                  className="flex-1 h-7 text-xs gap-1 text-success border-success/30 hover:bg-success/10"
                                  disabled={acting === dep.id + "approve"}
                                  onClick={() => handleAction(dep.id, "approve")}>
                                  {acting === dep.id + "approve" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline"
                                  className="flex-1 h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                                  disabled={acting === dep.id + "reject"}
                                  onClick={() => handleAction(dep.id, "reject")}>
                                  {acting === dep.id + "reject" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                                  Reject
                                </Button>
                              </div>
                            )}

                            {dep.status === "approved" && (
                              <Button size="sm" className="w-full h-7 text-xs gap-1"
                                disabled={acting === dep.id + "deploy"}
                                onClick={() => handleAction(dep.id, "deploy")}>
                                {acting === dep.id + "deploy" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
                                Deploy Now
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom environments */}
          {custom.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Custom Environments</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {custom.map((dep) => {
                    const sc = STATUS_CONFIG[dep.status] ?? { label: dep.status, color: "text-muted-foreground", icon: null };
                    return (
                      <div key={dep.id} className="py-3 flex items-center gap-3 text-sm">
                        <Badge variant="outline" className="text-xs">{dep.custom_env_name ?? dep.environment}</Badge>
                        <span className="flex-1 truncate text-xs">{dep.pipelines?.repo_full_name ?? dep.pipeline_id}</span>
                        {dep.version && <code className="text-xs text-muted-foreground">{dep.version}</code>}
                        <span className={`flex items-center gap-1 text-xs ${sc.color}`}>{sc.icon} {sc.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Deployment History</CardTitle></CardHeader>
            <CardContent>
              {deployments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No deployments yet. Click "New Deployment" to get started.</p>
              ) : (
                <div className="divide-y divide-border">
                  {deployments.slice(0, 20).map((dep) => {
                    const sc = STATUS_CONFIG[dep.status] ?? { label: dep.status, color: "text-muted-foreground", icon: null };
                    const envCfg = ENV_CONFIG[dep.environment];
                    return (
                      <div key={dep.id} className="py-2.5 flex items-center gap-3 text-xs">
                        <span className={`${envCfg?.color ?? "text-muted-foreground"} flex-shrink-0`}>
                          {envCfg?.icon ?? <Rocket className="w-3.5 h-3.5" />}
                        </span>
                        <span className="flex-1 truncate font-medium">{dep.pipelines?.repo_full_name ?? dep.pipeline_id}</span>
                        <Badge variant="outline" className="text-xs">{dep.custom_env_name ?? dep.environment}</Badge>
                        {dep.version && <code className="text-muted-foreground truncate max-w-[80px]">{dep.version.slice(0, 8)}</code>}
                        <span className={`flex items-center gap-1 ${sc.color}`}>{sc.icon} {sc.label}</span>
                        <span className="text-muted-foreground flex-shrink-0">{fmtDate(dep.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
