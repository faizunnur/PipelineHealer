"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Loader2, Bot, ChevronDown, ChevronUp, BarChart3, GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

type Pattern = {
  id: string; title: string; error_signature: string; affected_repos: string[];
  occurrence_count: number; last_seen_at: string; root_cause: string | null;
  ai_suggestion: string | null;
};

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInsight, setLoadingInsight] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/patterns").then((r) => r.json()).then((d) => {
      setPatterns(d.patterns ?? []);
      setLoading(false);
    });
  }, []);

  async function getInsight(id: string) {
    setLoadingInsight(id);
    const res = await fetch("/api/patterns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patternId: id }),
    });
    const data = await res.json();
    setPatterns((prev) => prev.map((p) => p.id === id ? { ...p, ai_suggestion: data.insight } : p));
    setLoadingInsight(null);
    setExpanded((prev) => { const n = new Set(prev); n.add(id); return n; });
  }

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" /> Failure Patterns
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Recurring errors detected across your repositories — fix once, prevent everywhere
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold">{patterns.length}</div>
          <div className="text-xs text-muted-foreground">Unique Patterns</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-destructive">
            {patterns.reduce((s, p) => s + p.occurrence_count, 0)}
          </div>
          <div className="text-xs text-muted-foreground">Total Occurrences</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-warning">
            {new Set(patterns.flatMap((p) => p.affected_repos)).size}
          </div>
          <div className="text-xs text-muted-foreground">Affected Repos</div>
        </CardContent></Card>
      </div>

      {patterns.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium">No patterns detected yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              As your pipelines fail and get healed, patterns will appear here automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pattern cards */}
      <div className="space-y-3">
        {patterns.map((p) => {
          const isExp = expanded.has(p.id);
          const heat = Math.min(p.occurrence_count / 10, 1);
          const heatColor = heat > 0.7 ? "text-destructive" : heat > 0.4 ? "text-warning" : "text-primary";

          return (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`text-2xl font-black flex-shrink-0 ${heatColor} min-w-[3rem] text-center`}>
                    {p.occurrence_count}×
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p.title}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {p.affected_repos.slice(0, 4).map((r) => (
                        <Badge key={r} variant="secondary" className="text-xs">
                          <GitBranch className="w-2.5 h-2.5 mr-1" />{r}
                        </Badge>
                      ))}
                      {p.affected_repos.length > 4 && (
                        <Badge variant="outline" className="text-xs">+{p.affected_repos.length - 4} more</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last seen {formatRelativeTime(p.last_seen_at)}
                    </p>

                    {/* AI Insight */}
                    {p.ai_suggestion && isExp && (
                      <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        <p className="text-xs font-medium text-primary flex items-center gap-1 mb-1">
                          <Bot className="w-3 h-3" /> AI Root Cause Analysis
                        </p>
                        <p className="text-xs text-muted-foreground">{p.ai_suggestion}</p>
                      </div>
                    )}

                    {!p.ai_suggestion && (
                      <Button variant="outline" size="sm" className="mt-2 text-xs h-7"
                        onClick={() => getInsight(p.id)} disabled={loadingInsight === p.id}>
                        {loadingInsight === p.id
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</>
                          : <><Bot className="w-3 h-3" /> Get AI Insight</>}
                      </Button>
                    )}

                    {p.ai_suggestion && (
                      <button onClick={() => toggle(p.id)}
                        className="text-xs text-primary hover:underline mt-2 flex items-center gap-1">
                        {isExp ? <><ChevronUp className="w-3 h-3" /> Hide insight</> : <><ChevronDown className="w-3 h-3" /> Show insight</>}
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
