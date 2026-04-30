"use client";

import { useState, useEffect } from "react";
import { BarChart3, Loader2, DollarSign, Clock, Users, GitBranch, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, LineChart, Line, AreaChart, Area, Cell,
} from "recharts";

type Build = { date: string; total: number; success: number; failed: number; avgDuration: number; cost: number };
type CostItem = { pipelineId: string; name: string; totalCost: number; totalMinutes: number; runs: number };
type AuthorItem = { author: string; total: number; success: number; failed: number };
type BranchItem = { branch: string; total: number; success: number; failed: number };
type Summary = { totalRuns: number; successRate: string; totalCost: string; avgDuration: number };

export default function AnalyticsPage() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [cost, setCost]   = useState<CostItem[]>([]);
  const [authors, setAuthors] = useState<AuthorItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [days, setDays]   = useState(30);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/analytics?days=${days}`);
    if (res.ok) {
      const d = await res.json();
      setBuilds(d.builds ?? []);
      setCost(d.costBreakdown ?? []);
      setAuthors(d.authors ?? []);
      setBranches(d.branches ?? []);
      setSummary(d.summary);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [days]);

  const successRateData = builds.map((b) => ({
    ...b,
    rate: b.total > 0 ? Math.round((b.success / b.total) * 100) : 0,
  }));

  const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Build Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Build trends, CI costs, author stats, and branch health
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
          {/* Summary KPIs */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <TrendingUp className="w-4 h-4" />,  label: "Total Runs",    value: summary.totalRuns.toLocaleString() },
                { icon: <TrendingUp className="w-4 h-4" />,  label: "Success Rate",  value: `${summary.successRate}%` },
                { icon: <Clock className="w-4 h-4" />,       label: "Avg Duration",  value: `${Math.floor(summary.avgDuration / 60)}m ${summary.avgDuration % 60}s` },
                { icon: <DollarSign className="w-4 h-4" />,  label: "Est. CI Cost",  value: `$${summary.totalCost}` },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">{s.icon}<span className="text-xs">{s.label}</span></div>
                    <div className="text-2xl font-bold">{s.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Build volume + Success rate */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Build Volume</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={builds} barSize={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="success" fill="hsl(var(--success))"     name="Success" radius={[2,2,0,0]} />
                    <Bar dataKey="failed"  fill="hsl(var(--destructive))" name="Failed"  radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Success Rate (%)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={successRateData}>
                    <defs>
                      <linearGradient id="gRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v) => [`${v}%`, "Success Rate"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                    <Area type="monotone" dataKey="rate" stroke="hsl(var(--primary))" fill="url(#gRate)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Avg Duration + Daily Cost */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Avg Build Duration (s)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={builds}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                    <Line type="monotone" dataKey="avgDuration" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} name="Avg Duration (s)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" /> Daily CI Cost (USD)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={builds}>
                    <defs>
                      <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--warning))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v.toFixed(2)}`} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(3)}`, "Cost"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                    <Area type="monotone" dataKey="cost" stroke="hsl(var(--warning))" fill="url(#gCost)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Cost per pipeline */}
          {cost.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" /> CI Cost by Pipeline (last {days}d)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cost.map((c, i) => (
                    <div key={c.pipelineId} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-xs flex-1 truncate font-medium">{c.name}</span>
                      <div className="flex-1 max-w-xs">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min((c.totalCost / (cost[0]?.totalCost || 1)) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-mono w-16 text-right text-muted-foreground">{c.totalMinutes.toFixed(0)} min</span>
                      <span className="text-xs font-mono w-16 text-right font-semibold">${c.totalCost.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">Estimated at $0.008/min (GitHub Linux runner). Windows 2×, macOS 10× more.</p>
              </CardContent>
            </Card>
          )}

          {/* Authors + Branches */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Author stats */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Builds by Author</CardTitle></CardHeader>
              <CardContent>
                {authors.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No data yet</p>
                ) : (
                  <div className="space-y-2">
                    {authors.slice(0, 10).map((a) => {
                      const rate = a.total > 0 ? Math.round((a.success / a.total) * 100) : 0;
                      return (
                        <div key={a.author} className="flex items-center gap-3 text-xs">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {a.author[0]?.toUpperCase()}
                          </div>
                          <span className="flex-1 truncate font-medium">{a.author}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-muted-foreground">{a.total} runs</span>
                            <span className={`font-semibold ${rate >= 80 ? "text-success" : rate >= 60 ? "text-yellow-500" : "text-destructive"}`}>
                              {rate}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Branch stats */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4" /> Branch Health</CardTitle></CardHeader>
              <CardContent>
                {branches.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No data yet</p>
                ) : (
                  <div className="space-y-2">
                    {branches.slice(0, 10).map((b) => {
                      const rate = b.total > 0 ? Math.round((b.success / b.total) * 100) : 0;
                      return (
                        <div key={b.branch} className="flex items-center gap-3 text-xs">
                          <GitBranch className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <code className="flex-1 truncate text-xs bg-muted px-1.5 py-0.5 rounded">{b.branch}</code>
                          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                            <div className={`h-full rounded-full ${rate >= 80 ? "bg-success" : rate >= 60 ? "bg-yellow-500" : "bg-destructive"}`}
                              style={{ width: `${rate}%` }} />
                          </div>
                          <span className={`font-semibold w-8 text-right ${rate >= 80 ? "text-success" : rate >= 60 ? "text-yellow-500" : "text-destructive"}`}>
                            {rate}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
