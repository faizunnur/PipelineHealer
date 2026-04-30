"use client";

import { useState, useEffect } from "react";
import { FileBarChart, Loader2, Play, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";

type PipelineStats = {
  pipelineId: string; repoName: string; totalRuns: number; successRuns: number;
  failedRuns: number; successRate: number; avgDurationMinutes: number;
  healingEvents: number; slaViolations: number;
};

type Report = {
  id: string; period: string; period_start: string; period_end: string;
  summary: string; created_at: string; stats: PipelineStats[];
};

const PERIOD_LABELS: Record<string, string> = {
  daily: "Last 24 Hours",
  weekly: "Last 7 Days",
  monthly: "Last 30 Days",
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  function exportCSV(report: Report) {
    const header = "Pipeline,Total Runs,Success Runs,Failed Runs,Success Rate %,Avg Duration (min),AI Heals,SLA Violations";
    const rows = (report.stats ?? []).map((s) =>
      [s.repoName, s.totalRuns, s.successRuns, s.failedRuns, s.successRate, s.avgDurationMinutes, s.healingEvents, s.slaViolations].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-report-${report.period}-${report.period_start.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON(report: Report) {
    const json = JSON.stringify({
      period: report.period,
      period_start: report.period_start,
      period_end: report.period_end,
      summary: report.summary,
      generated_at: report.created_at,
      pipelines: report.stats ?? [],
    }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-report-${report.period}-${report.period_start.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    fetch("/api/reports").then((r) => r.json()).then((d) => {
      setReports(d.reports ?? []);
      setLoading(false);
    });
  }, []);

  async function generateReport(period: "daily" | "weekly" | "monthly") {
    setGenerating(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    setGenerating(false);
    if (res.ok) {
      const d = await res.json();
      toast({ title: `${PERIOD_LABELS[period]} report generated!` });
      // Refetch list
      fetch("/api/reports").then((r) => r.json()).then((data) => {
        setReports(data.reports ?? []);
        setExpanded(d.reportId);
      });
    } else {
      const d = await res.json();
      toast({ title: "Failed to generate report", description: d.error, variant: "destructive" });
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-primary" /> Pipeline Health Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-generated summaries of your pipeline performance over time
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <Button key={p} variant="outline" size="sm" onClick={() => generateReport(p)}
              disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && reports.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <FileBarChart className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium">No reports yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click one of the buttons above to generate your first report
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {reports.map((report) => {
          const isExp = expanded === report.id;
          const stats: PipelineStats[] = report.stats ?? [];
          const avgSuccess = stats.length
            ? Math.round(stats.reduce((s, p) => s + p.successRate, 0) / stats.length)
            : null;
          const totalHeals = stats.reduce((s, p) => s + p.healingEvents, 0);
          const totalViolations = stats.reduce((s, p) => s + p.slaViolations, 0);

          return (
            <Card key={report.id} className={isExp ? "ring-1 ring-primary/30" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="capitalize">{report.period}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(report.period_start).toLocaleDateString()} – {new Date(report.period_end).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {avgSuccess !== null && (
                      <div className="flex items-center gap-1">
                        {avgSuccess >= 80
                          ? <TrendingUp className="w-4 h-4 text-success" />
                          : <TrendingDown className="w-4 h-4 text-destructive" />}
                        <span className={`text-sm font-medium ${avgSuccess >= 80 ? "text-success" : "text-destructive"}`}>
                          {avgSuccess}% avg success
                        </span>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(report.created_at)}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => exportCSV(report)}>
                        <Download className="w-3 h-3" /> CSV
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => exportJSON(report)}>
                        <Download className="w-3 h-3" /> JSON
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7"
                        onClick={() => setExpanded(isExp ? null : report.id)}>
                        {isExp ? "Collapse" : "Expand"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* AI Summary */}
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-xs text-muted-foreground">{report.summary}</p>
                </div>

                {/* Quick stats row */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center">
                    <div className="text-lg font-bold">{stats.length}</div>
                    <div className="text-xs text-muted-foreground">Pipelines</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-bold ${avgSuccess !== null && avgSuccess >= 80 ? "text-success" : "text-destructive"}`}>
                      {avgSuccess ?? "—"}%
                    </div>
                    <div className="text-xs text-muted-foreground">Avg Success</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{totalHeals}</div>
                    <div className="text-xs text-muted-foreground">AI Heals</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-bold ${totalViolations > 0 ? "text-destructive" : "text-success"}`}>
                      {totalViolations}
                    </div>
                    <div className="text-xs text-muted-foreground">SLA Violations</div>
                  </div>
                </div>

                {/* Per-pipeline breakdown */}
                {isExp && stats.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Per-Pipeline Breakdown</p>
                    {stats.map((s) => (
                      <div key={s.pipelineId}
                        className="flex items-center gap-3 p-3 rounded-md bg-muted/30 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{s.repoName}</p>
                          <p className="text-muted-foreground">
                            {s.totalRuns} runs · {s.avgDurationMinutes}min avg
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-center">
                            <div className={`font-bold ${s.successRate >= 80 ? "text-success" : "text-destructive"}`}>
                              {s.successRate}%
                            </div>
                            <div className="text-muted-foreground">success</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-primary">{s.healingEvents}</div>
                            <div className="text-muted-foreground">heals</div>
                          </div>
                          {s.slaViolations > 0 && (
                            <div className="flex items-center gap-1 text-destructive">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{s.slaViolations} SLA</span>
                            </div>
                          )}
                          {s.slaViolations === 0 && s.totalRuns > 0 && (
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
