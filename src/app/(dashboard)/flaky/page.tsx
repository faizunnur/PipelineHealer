"use client";

import { useState, useEffect } from "react";
import { FlaskConical, EyeOff, TrendingDown, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";

type FlakyTest = {
  id: string; test_name: string; pipeline_id: string;
  failure_count: number; pass_count: number; total_runs: number;
  flakiness_score: number; last_seen_at: string; is_suppressed: boolean;
  pipelines: { repo_full_name: string } | null;
};

function FlakinessBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 50 ? "bg-destructive" : pct >= 25 ? "bg-warning" : "bg-yellow-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function FlakyTestsPage() {
  const [tests, setTests] = useState<FlakyTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTests(); }, []);

  async function loadTests() {
    const res = await fetch("/api/flaky");
    const data = await res.json();
    setTests(data.tests ?? []);
    setLoading(false);
  }

  async function suppress(id: string) {
    await fetch(`/api/flaky?id=${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_suppressed: true }),
    });
    setTests((prev) => prev.filter((t) => t.id !== id));
    toast({ title: "Test suppressed from healing queue" });
  }

  const highFlaky = tests.filter((t) => t.flakiness_score >= 0.5);
  const medFlaky = tests.filter((t) => t.flakiness_score >= 0.25 && t.flakiness_score < 0.5);
  const lowFlaky = tests.filter((t) => t.flakiness_score < 0.25);

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-warning" /> Flaky Test Detector
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tests that fail intermittently — suppress them from the healing queue to reduce noise
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "High Flakiness (≥50%)", count: highFlaky.length, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Medium Flakiness (25–50%)", count: medFlaky.length, color: "text-warning", bg: "bg-warning/10" },
          { label: "Low Flakiness (<25%)", count: lowFlaky.length, color: "text-yellow-500", bg: "bg-yellow-500/10" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && tests.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
            <p className="font-medium">No flaky tests detected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Flaky tests are automatically detected as your pipelines run. Come back after a few runs!
            </p>
          </CardContent>
        </Card>
      )}

      {tests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-warning" />
              Flaky Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border">
            {tests.map((test) => (
              <div key={test.id} className="py-4 flex items-start gap-3">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-1 ${
                  test.flakiness_score >= 0.5 ? "text-destructive" :
                  test.flakiness_score >= 0.25 ? "text-warning" : "text-yellow-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium break-all">{test.test_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {test.pipelines?.repo_full_name ?? "Unknown repo"}
                  </p>
                  <div className="mt-2 w-48">
                    <FlakinessBar score={test.flakiness_score} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="text-destructive">❌ {test.failure_count} fails</span>
                    <span className="text-success">✅ {test.pass_count} passes</span>
                    <span>{test.total_runs} total runs</span>
                    <span>Last: {formatRelativeTime(test.last_seen_at)}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => suppress(test.id)}
                  className="flex-shrink-0 text-xs gap-1">
                  <EyeOff className="w-3 h-3" /> Suppress
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How flaky detection works</p>
          <p>PipelineHealer tracks every test result across all pipeline runs. If a test fails more than 25% of the time it has run, it&apos;s flagged as flaky.</p>
          <p>Suppressed tests are excluded from the AI healing queue — Claude won&apos;t waste tokens analyzing a test that&apos;s inherently unreliable.</p>
        </CardContent>
      </Card>
    </div>
  );
}
