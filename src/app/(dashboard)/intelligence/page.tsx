"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Cpu, Loader2, Sparkles, Trash2, AlertTriangle, AlertCircle,
  Info, CheckCircle2, FileCode, Zap, BarChart3, Search, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type AiFixResult = {
  explanation: string;
  original_code: string | null;
  fixed_code: string | null;
  confidence: "high" | "medium" | "low";
};

type AiFixItem = {
  id: string;
  source: "env_audit" | "security_scan";
  file_path: string;
  severity: string;
  rule: string;
  title: string;
  ai_fix_result: AiFixResult;
  is_resolved: boolean;
  pipeline_id: string;
  created_at: string;
};

type TokenUsage = {
  feature: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  total: number;
  calls: number;
  last_used: string;
};

const SEV_COLOR: Record<string, string> = {
  critical: "text-destructive",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
  info: "text-muted-foreground",
};

const SEV_ICON: Record<string, React.ReactNode> = {
  critical: <AlertTriangle className="w-3.5 h-3.5" />,
  high: <AlertCircle className="w-3.5 h-3.5" />,
  medium: <AlertCircle className="w-3.5 h-3.5" />,
  low: <Info className="w-3.5 h-3.5" />,
  info: <Info className="w-3.5 h-3.5" />,
};

const FEATURE_LABEL: Record<string, string> = {
  healing: "Auto Healing",
  chat: "AI Assistant",
  "ai-fix": "AI Fix",
  optimize: "Optimizer",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-success border-success/40 bg-success/5",
  medium: "text-yellow-500 border-yellow-500/40 bg-yellow-500/5",
  low: "text-muted-foreground border-border bg-muted/30",
};

const SEVERITY_OPTS = ["all", "critical", "high", "medium", "low", "info"];
const SOURCE_OPTS = [
  { value: "all", label: "All Sources" },
  { value: "env_audit", label: "Env Audit" },
  { value: "security_scan", label: "Security Scan" },
];
const STATUS_OPTS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "resolved", label: "Applied" },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IntelligencePage() {
  const [aiFixes, setAiFixes] = useState<AiFixItem[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"fixes" | "tokens">("fixes");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  // Filters — fix history
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filters — token usage
  const [tokenSearch, setTokenSearch] = useState("");

  useEffect(() => {
    fetch("/api/intelligence")
      .then((r) => r.json())
      .then((d) => {
        setAiFixes(d.ai_fixes ?? []);
        setTokenUsage(d.token_usage ?? []);
        setLoading(false);
      });
  }, []);

  async function deleteItem(item: AiFixItem) {
    setDeleting(item.id);
    await fetch("/api/intelligence", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ findingId: item.id, source: item.source }),
    });
    setAiFixes((prev) => prev.filter((f) => f.id !== item.id));
    setDeleting(null);
    toast({ title: "Removed from history" });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const filteredFixes = useMemo(() => {
    const q = search.toLowerCase();
    return aiFixes.filter((item) => {
      if (q && !(
        item.title?.toLowerCase().includes(q) ||
        item.rule?.toLowerCase().includes(q) ||
        item.file_path?.toLowerCase().includes(q)
      )) return false;
      if (sevFilter !== "all" && item.severity !== sevFilter) return false;
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      if (statusFilter === "active" && item.is_resolved) return false;
      if (statusFilter === "resolved" && !item.is_resolved) return false;
      return true;
    });
  }, [aiFixes, search, sevFilter, sourceFilter, statusFilter]);

  const filteredTokens = useMemo(() => {
    if (!tokenSearch) return tokenUsage;
    const q = tokenSearch.toLowerCase();
    return tokenUsage.filter((r) =>
      (FEATURE_LABEL[r.feature] ?? r.feature).toLowerCase().includes(q) ||
      r.model.toLowerCase().includes(q) ||
      r.feature.toLowerCase().includes(q)
    );
  }, [tokenUsage, tokenSearch]);

  const hasFixFilters = search || sevFilter !== "all" || sourceFilter !== "all" || statusFilter !== "all";

  function clearFixFilters() {
    setSearch("");
    setSevFilter("all");
    setSourceFilter("all");
    setStatusFilter("all");
  }

  const totalTokens = tokenUsage.reduce((s, r) => s + r.total, 0);
  const totalCalls = tokenUsage.reduce((s, r) => s + r.calls, 0);
  const filteredTokenTotal = filteredTokens.reduce((s, r) => s + r.total, 0);
  const filteredCallTotal = filteredTokens.reduce((s, r) => s + r.calls, 0);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cpu className="w-6 h-6 text-primary" /> Intelligence
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI fix history and token usage details. History is kept until you delete it.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["fixes", "tokens"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2 ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "fixes" ? (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> AI Fix History
                {aiFixes.length > 0 && (
                  <span className="ml-0.5 text-xs bg-primary/10 text-primary rounded-full px-1.5">
                    {aiFixes.length}
                  </span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Token Usage</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : activeTab === "fixes" ? (
        /* ── AI Fix History ── */
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by title, rule, file path…"
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Severity chips */}
            <div className="flex gap-1 flex-wrap">
              {SEVERITY_OPTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSevFilter(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                    sevFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {s === "all" ? "All Severity" : s}
                </button>
              ))}
            </div>

            {/* Source select */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs"
            >
              {SOURCE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Status select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs"
            >
              {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {hasFixFilters && (
              <Button variant="ghost" size="sm" onClick={clearFixFilters} className="h-9 text-xs gap-1 text-muted-foreground">
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>

          {/* Result count */}
          {hasFixFilters && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredFixes.length} of {aiFixes.length} entries
            </p>
          )}

          {aiFixes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="font-medium">No AI fix history yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use "Fix with AI" on any security finding in Env Audit or Security Scanner.
                </p>
              </CardContent>
            </Card>
          ) : filteredFixes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">No results match your filters</p>
                <button onClick={clearFixFilters} className="text-xs text-primary hover:underline mt-2">Clear filters</button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredFixes.map((item) => {
                const isOpen = expanded[item.id];
                return (
                  <Card key={item.id} className={item.is_resolved ? "opacity-60" : ""}>
                    <CardContent className="p-4 space-y-3">
                      {/* Header row */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`flex items-center gap-1 text-xs font-semibold ${SEV_COLOR[item.severity] ?? "text-muted-foreground"}`}>
                              {SEV_ICON[item.severity]} {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                            </span>
                            <Badge variant="outline" className="text-xs font-mono">{item.rule}</Badge>
                            <Badge variant="secondary" className="text-xs">
                              {item.source === "env_audit" ? "Env Audit" : "Security Scan"}
                            </Badge>
                            {item.is_resolved && (
                              <Badge variant="success" className="text-xs gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Applied
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <FileCode className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <code className="text-xs text-muted-foreground truncate">{item.file_path}</code>
                            <span className="text-xs text-muted-foreground flex-shrink-0">{relativeTime(item.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleExpand(item.id)}
                            className="text-xs px-2.5 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                          >
                            {isOpen ? "Collapse" : "View Fix"}
                          </button>
                          <button
                            onClick={() => deleteItem(item)}
                            disabled={deleting === item.id}
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            title="Delete from history"
                          >
                            {deleting === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded fix view */}
                      {isOpen && (
                        <div className="border border-primary/20 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-primary/5 border-b border-primary/20 flex items-center justify-between">
                            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3" /> AI-Generated Fix
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${CONFIDENCE_COLOR[item.ai_fix_result.confidence]}`}>
                              {item.ai_fix_result.confidence} confidence
                            </Badge>
                          </div>
                          <div className="p-3 space-y-3">
                            <p className="text-xs text-muted-foreground">{item.ai_fix_result.explanation}</p>
                            {item.ai_fix_result.original_code && item.ai_fix_result.fixed_code ? (
                              <div className="space-y-1.5">
                                <div className="rounded-md overflow-hidden border border-destructive/20">
                                  <div className="px-2.5 py-1 bg-destructive/10 text-[10px] font-semibold text-destructive/80 uppercase tracking-wide">Before</div>
                                  <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-destructive/5 text-foreground max-h-40">{item.ai_fix_result.original_code}</pre>
                                </div>
                                <div className="rounded-md overflow-hidden border border-success/20">
                                  <div className="px-2.5 py-1 bg-success/10 text-[10px] font-semibold text-success/80 uppercase tracking-wide">After</div>
                                  <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-success/5 text-foreground max-h-40">{item.ai_fix_result.fixed_code}</pre>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No code snippet — apply recommendation manually.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Token Usage ── */
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">{fmt(totalTokens)}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Tokens</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{totalCalls}</div>
                <div className="text-xs text-muted-foreground mt-1">API Calls</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-success">{fmt(tokenUsage.reduce((s, r) => s + r.tokens_in, 0))}</div>
                <div className="text-xs text-muted-foreground mt-1">Input Tokens</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-warning">{fmt(tokenUsage.reduce((s, r) => s + r.tokens_out, 0))}</div>
                <div className="text-xs text-muted-foreground mt-1">Output Tokens</div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by feature or model…"
              className="pl-9 h-9 text-sm"
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
            />
            {tokenSearch && (
              <button onClick={() => setTokenSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Per-feature breakdown */}
          {tokenUsage.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="font-medium">No token usage recorded yet</p>
                <p className="text-sm text-muted-foreground mt-1">Token usage is tracked when you use AI features.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> Usage by Feature
                  </span>
                  {tokenSearch && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {filteredTokens.length} of {tokenUsage.length} features
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Feature</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Model</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">API Calls</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Tokens In</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Tokens Out</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Total</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">% of All</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Last Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTokens.map((row, i) => {
                        const pct = totalTokens > 0 ? Math.round((row.total / totalTokens) * 100) : 0;
                        return (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium">
                              <span className="flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-primary" />
                                {FEATURE_LABEL[row.feature] ?? row.feature}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground font-mono">{row.model}</td>
                            <td className="px-4 py-2.5 text-right">{row.calls}</td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(row.tokens_in)}</td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(row.tokens_out)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-primary">{fmt(row.total)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-muted-foreground w-7 text-right">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">{relativeTime(row.last_used)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30">
                        <td className="px-4 py-2.5 font-semibold" colSpan={2}>
                          {tokenSearch ? "Filtered total" : "Grand total"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">{filteredCallTotal}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{fmt(filteredTokens.reduce((s, r) => s + r.tokens_in, 0))}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{fmt(filteredTokens.reduce((s, r) => s + r.tokens_out, 0))}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-primary">{fmt(filteredTokenTotal)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
