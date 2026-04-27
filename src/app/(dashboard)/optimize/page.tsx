"use client";

import { useState, useEffect } from "react";
import { Zap, Play, CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Pipeline = { id: string; repo_full_name: string; provider: string };
type Suggestion = {
  id: string; category: string; title: string; description: string;
  estimated_saving: string; original_code: string | null; optimized_code: string | null;
  status: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  parallelism: "bg-blue-500/10 text-blue-400",
  caching: "bg-green-500/10 text-green-400",
  matrix: "bg-purple-500/10 text-purple-400",
  splitting: "bg-orange-500/10 text-orange-400",
  runner: "bg-yellow-500/10 text-yellow-400",
  misc: "bg-gray-500/10 text-gray-400",
};

const CATEGORY_ICONS: Record<string, string> = {
  parallelism: "⚡", caching: "📦", matrix: "⊞", splitting: "✂️", runner: "🖥️", misc: "⚙️",
};

export default function OptimizePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pipelines")
      .then((r) => r.json())
      .then(({ pipelines: data }) => {
        const list = (data ?? []) as Pipeline[];
        setPipelines(list);
        if (list[0]) { setSelected(list[0].id); loadSuggestions(list[0].id); }
        setLoading(false);
      });
  }, []);

  async function loadSuggestions(pipelineId: string) {
    const res = await fetch(`/api/optimize/${pipelineId}`);
    const data = await res.json();
    setSuggestions(data.suggestions ?? []);
  }

  async function handleAnalyze() {
    if (!selected) return;
    setAnalyzing(true);
    const res = await fetch(`/api/optimize/${selected}`, { method: "POST" });
    const data = await res.json();
    setAnalyzing(false);
    if (res.ok) {
      setSuggestions(data.suggestions ?? []);
      toast({ title: `Found ${data.suggestions.length} optimization${data.suggestions.length !== 1 ? "s" : ""}!`,
        description: `Analyzed ${data.workflow_path} · ${data.tokens_used} tokens` });
    } else {
      toast({ title: "Analysis failed", description: data.error, variant: "destructive" });
    }
  }

  async function dismissSuggestion(id: string) {
    await fetch(`/api/optimize/${selected}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const pending = suggestions.filter((s) => s.status === "pending");
  const totalSaving = pending.map((s) => s.estimated_saving).join(" + ");

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary" /> Pipeline Optimizer
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Claude AI analyzes your workflow files and finds specific speed improvements
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <select
            value={selected}
            onChange={(e) => { setSelected(e.target.value); loadSuggestions(e.target.value); }}
            className="flex-1 min-w-[200px] h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.repo_full_name}</option>
            ))}
          </select>
          <Button onClick={handleAnalyze} disabled={!selected || analyzing}>
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {analyzing ? "Analyzing..." : "Analyze Pipeline"}
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      {pending.length > 0 && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
          <p className="text-sm font-medium text-primary">
            🚀 {pending.length} optimization{pending.length !== 1 ? "s" : ""} found
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Estimated total saving: {totalSaving || "See individual suggestions"}
          </p>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length === 0 && !analyzing && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium">No analysis yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Select a pipeline and click &quot;Analyze&quot; to get optimization suggestions
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {suggestions.filter((s) => s.status !== "dismissed").map((s) => {
          const isExpanded = expanded.has(s.id);
          return (
            <Card key={s.id} className={s.status === "applied" ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{CATEGORY_ICONS[s.category] ?? "⚙️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.title}</span>
                      <Badge className={`text-xs ${CATEGORY_COLORS[s.category]}`}>
                        {s.category}
                      </Badge>
                      {s.estimated_saving && (
                        <Badge variant="success" className="text-xs">
                          <Clock className="w-2.5 h-2.5 mr-1" />{s.estimated_saving}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{s.description}</p>

                    {(s.original_code || s.optimized_code) && (
                      <button onClick={() => toggleExpand(s.id)}
                        className="text-xs text-primary hover:underline mt-2 flex items-center gap-1">
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? "Hide" : "Show"} code diff
                      </button>
                    )}

                    {isExpanded && (
                      <div className="mt-3 grid md:grid-cols-2 gap-3">
                        {s.original_code && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-destructive" /> Before
                            </p>
                            <pre className="text-xs bg-destructive/10 border border-destructive/20 text-red-400 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                              {s.original_code}
                            </pre>
                          </div>
                        )}
                        {s.optimized_code && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-success" /> After
                            </p>
                            <pre className="text-xs bg-success/10 border border-success/20 text-green-400 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                              {s.optimized_code}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground"
                      onClick={() => dismissSuggestion(s.id)}>
                      Dismiss
                    </Button>
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
