"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Loader2, RefreshCw, Rocket, Clock, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";

type DoraMetric = { value: string | null; unit: string; level: "elite" | "high" | "medium" | "low" };
type DoraData = {
  deploymentFrequency: DoraMetric;
  leadTime: DoraMetric;
  mttr: DoraMetric;
  changeFailureRate: DoraMetric;
};
type Build = { date: string; total: number; success: number; failed: number; avgDuration: number };

const LEVEL_CONFIG = {
  elite:  { label: "Elite",  color: "text-success",      bg: "bg-success/10",      border: "border-success/30" },
  high:   { label: "High",   color: "text-primary",      bg: "bg-primary/10",      border: "border-primary/30" },
  medium: { label: "Medium", color: "text-yellow-500",   bg: "bg-yellow-500/10",   border: "border-yellow-500/30" },
  low:    { label: "Low",    color: "text-destructive",  bg: "bg-destructive/10",  border: "border-destructive/30" },
};

const DORA_BENCHMARKS = {
  deploymentFrequency: { elite: "Multiple/day", high: "Once/day–week", medium: "Once/week–month", low: "<Once/month" },
  leadTime:            { elite: "<1 hour",      high: "<1 day",        medium: "<1 week",          low: ">1 week" },
  mttr:                { elite: "<1 hour",      high: "<1 day",        medium: "<1 week",          low: ">1 week" },
  changeFailureRate:   { elite: "0–5%",         high: "5–10%",         medium: "10–15%",           low: ">15%" },
};

export default function DoraPage() {
  const [dora, setDora] = useState<DoraData | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [summary, setSummary] = useState<{ totalRuns: number; successRate: string; totalCost: string; avgDuration: number } | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/analytics?days=${days}`);
    if (res.ok) {
      const data = await res.json();
      setDora(data.dora);
      setBuilds(data.builds ?? []);
      setSummary(data.summary);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [days]);

  const metrics = dora ? [
    {
      key: "deploymentFrequency",
      label: "Deployment Frequency",
      icon: <Rocket className="w-5 h-5" />,
      description: "How often code is deployed to production",
      metric: dora.deploymentFrequency,
    },
    {
      key: "leadTime",
      label: "Lead Time for Changes",
      icon: <Clock className="w-5 h-5" />,
      description: "Time from code commit to running in production",
      metric: dora.leadTime,
    },
    {
      key: "mttr",
      label: "Mean Time to Recovery",
      icon: <RefreshCw className="w-5 h-5" />,
      description: "How fast you recover from a production failure",
      metric: dora.mttr,
    },
    {
      key: "changeFailureRate",
      label: "Change Failure Rate",
      icon: <AlertTriangle className="w-5 h-5" />,
      description: "Percentage of deployments causing a failure",
      metric: dora.changeFailureRate,
    },
  ] : [];

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> DORA Metrics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Industry-standard engineering performance benchmarks
          </p>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${days === d ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary bar */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Runs",    value: summary.totalRuns },
                { label: "Success Rate",  value: `${summary.successRate}%` },
                { label: "Avg Duration",  value: `${Math.floor(summary.avgDuration / 60)}m ${summary.avgDuration % 60}s` },
                { label: "Est. CI Cost",  value: `$${summary.totalCost}` },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* DORA Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map(({ key, label, icon, description, metric }) => {
              const cfg = LEVEL_CONFIG[metric.level];
              const bench = DORA_BENCHMARKS[key as keyof typeof DORA_BENCHMARKS];
              return (
                <Card key={key} className={`border ${cfg.border}`}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`${cfg.color}`}>{icon}</span>
                      <Badge className={`text-xs ${cfg.bg} ${cfg.color} border-0`}>{cfg.label}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      <div className="flex items-end gap-1 mt-1">
                        <span className={`text-2xl font-bold ${cfg.color}`}>
                          {metric.value ?? "N/A"}
                        </span>
                        {metric.value && <span className="text-xs text-muted-foreground mb-1">{metric.unit}</span>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                    {/* Benchmark legend */}
                    <div className="space-y-1 pt-1 border-t border-border">
                      {(["elite","high","medium","low"] as const).map((lvl) => (
                        <div key={lvl} className={`flex items-center gap-1.5 text-xs ${LEVEL_CONFIG[lvl].color} ${metric.level === lvl ? "font-semibold" : "opacity-50"}`}>
                          {metric.level === lvl ? <CheckCircle2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          <span>{LEVEL_CONFIG[lvl].label}: {bench[lvl]}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Deployment Frequency Chart */}
          {builds.length > 0 && (
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Daily Deployments</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={builds}>
                      <defs>
                        <linearGradient id="gSuccess" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gFailed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="success" stroke="hsl(var(--success))" fill="url(#gSuccess)" name="Success" />
                      <Area type="monotone" dataKey="failed"  stroke="hsl(var(--destructive))" fill="url(#gFailed)" name="Failed" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Avg Build Duration (seconds)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={builds}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="avgDuration" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Avg Duration (s)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Info box */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex gap-3">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                DORA metrics are based on your pipeline run history. Lead time is measured from job start to completion.
                MTTR measures the gap between a failure and the next successful run on the same branch.
                More runs = more accurate metrics.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
