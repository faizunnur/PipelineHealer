"use client";

import { useState, useEffect } from "react";
import {
  Target, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2,
  Clock, TrendingDown, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";

type SLARule = {
  id: string; name: string; metric: string; threshold: number;
  window_hours: number; is_active: boolean; created_at: string;
  pipelines: { repo_full_name: string } | null;
  sla_violations: Array<{ id: string; actual_value: number; threshold: number; created_at: string }>;
};

type Pipeline = { id: string; repo_full_name: string };

const METRIC_CONFIG: Record<string, { label: string; unit: string; icon: React.ReactNode; description: string }> = {
  max_duration: { label: "Max Duration", unit: "minutes", icon: <Clock className="w-4 h-4" />, description: "Alert if pipeline takes longer than threshold" },
  max_failures_per_day: { label: "Max Failures/Day", unit: "failures", icon: <TrendingDown className="w-4 h-4" />, description: "Alert if more failures than threshold in 24h" },
  max_consecutive_failures: { label: "Max Consecutive Failures", unit: "runs", icon: <AlertTriangle className="w-4 h-4" />, description: "Alert after N consecutive failures" },
  min_success_rate: { label: "Min Success Rate", unit: "%", icon: <Activity className="w-4 h-4" />, description: "Alert if success rate drops below threshold" },
};

export default function SLAPage() {
  const [rules, setRules] = useState<SLARule[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    pipeline_id: "", name: "", metric: "max_duration", threshold: "30", window_hours: "24"
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      Promise.all([
        fetch("/api/sla").then((r) => r.json()),
        supabase.from("pipelines").select("id, repo_full_name").eq("user_id", user.id),
      ]).then(([slaData, pipelineData]) => {
        setRules(slaData.rules ?? []);
        setPipelines(pipelineData.data ?? []);
        if (pipelineData.data?.[0]) setForm((f) => ({ ...f, pipeline_id: pipelineData.data![0].id }));
        setLoading(false);
      });
    });
  }, []);

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/sla", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, threshold: parseFloat(form.threshold), window_hours: parseInt(form.window_hours) }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "SLA rule created!" });
      setAddOpen(false);
      const data = await fetch("/api/sla").then((r) => r.json());
      setRules(data.rules ?? []);
    } else {
      const d = await res.json();
      toast({ title: "Failed", description: d.error, variant: "destructive" });
    }
  }

  async function deleteRule(id: string) {
    await fetch(`/api/sla?id=${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "SLA rule removed" });
  }

  const totalViolations = rules.reduce((s, r) => s + (r.sla_violations?.length ?? 0), 0);
  const activeRules = rules.filter((r) => r.is_active).length;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> SLA Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define performance targets and get alerted when pipelines breach them
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4" /> Add SLA Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create SLA Rule</DialogTitle></DialogHeader>
            <form onSubmit={addRule} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Pipeline</Label>
                <select value={form.pipeline_id} onChange={(e) => setForm((f) => ({ ...f, pipeline_id: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.repo_full_name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input placeholder="e.g. Build must complete in 10 min"
                  value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Metric</Label>
                <select value={form.metric} onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(METRIC_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{METRIC_CONFIG[form.metric]?.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Threshold ({METRIC_CONFIG[form.metric]?.unit})</Label>
                  <Input type="number" value={form.threshold}
                    onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Window (hours)</Label>
                  <Input type="number" value={form.window_hours}
                    onChange={(e) => setForm((f) => ({ ...f, window_hours: e.target.value }))} required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving || !form.pipeline_id}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create SLA Rule
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-primary">{activeRules}</div>
          <div className="text-xs text-muted-foreground">Active Rules</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className={`text-2xl font-bold ${totalViolations > 0 ? "text-destructive" : "text-success"}`}>{totalViolations}</div>
          <div className="text-xs text-muted-foreground">Recent Violations</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold">{rules.filter((r) => !r.sla_violations?.length).length}</div>
          <div className="text-xs text-muted-foreground">Rules Met</div>
        </CardContent></Card>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>}

      {!loading && rules.length === 0 && (
        <Card className="border-dashed"><CardContent className="py-16 text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium">No SLA rules yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create rules to track pipeline performance targets</p>
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {rules.map((rule) => {
          const cfg = METRIC_CONFIG[rule.metric];
          const hasViolations = (rule.sla_violations?.length ?? 0) > 0;
          return (
            <Card key={rule.id} className={hasViolations ? "border-destructive/30" : "border-success/20"}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${hasViolations ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {cfg?.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{rule.name}</span>
                      {hasViolations
                        ? <Badge variant="destructive" className="text-xs"><AlertTriangle className="w-2.5 h-2.5 mr-1" />Violated</Badge>
                        : <Badge variant="success" className="text-xs"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Met</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rule.pipelines?.repo_full_name} · {cfg?.label}: {rule.threshold}{cfg?.unit && ` ${cfg.unit}`} · {rule.window_hours}h window
                    </p>
                    {hasViolations && (
                      <p className="text-xs text-destructive mt-1">
                        {rule.sla_violations.length} violation{rule.sla_violations.length !== 1 ? "s" : ""}
                        {rule.sla_violations[0] && ` · Last: ${formatRelativeTime(rule.sla_violations[0].created_at)}`}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive flex-shrink-0"
                    onClick={() => deleteRule(rule.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
