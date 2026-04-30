"use client";

import { useState, useMemo } from "react";
import { Search, X, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type UsageRow = {
  user_id: string;
  feature: string;
  tokens_in: number;
  tokens_out: number;
  total: number;
  model: string;
  created_at: string;
  profiles: { email: string; full_name: string | null } | null;
};

type UserEntry = {
  email: string;
  name: string | null;
  byFeature: Record<string, number>;
  total: number;
};

const FEATURE_LABEL: Record<string, string> = {
  healing: "Auto Healing",
  chat: "AI Assistant",
  "ai-fix": "AI Fix",
  optimize: "Optimizer",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function AdminUsageClient({ rows }: { rows: UsageRow[] }) {
  const [search, setSearch] = useState("");
  const [featureFilter, setFeatureFilter] = useState("all");

  // Aggregate by user, then by feature
  const { aggregated, allFeatures, grandTotal } = useMemo(() => {
    const userMap = new Map<string, UserEntry>();
    const featureSet = new Set<string>();

    for (const row of rows) {
      if (!row.profiles) continue;
      featureSet.add(row.feature);

      const entry = userMap.get(row.user_id) ?? {
        email: row.profiles.email,
        name: row.profiles.full_name,
        byFeature: {},
        total: 0,
      };

      entry.byFeature[row.feature] = (entry.byFeature[row.feature] ?? 0) + (row.total ?? 0);
      entry.total += row.total ?? 0;
      userMap.set(row.user_id, entry);
    }

    const allFeatures = Array.from(featureSet).sort();
    const aggregated = Array.from(userMap.entries())
      .sort((a, b) => b[1].total - a[1].total);
    const grandTotal = aggregated.reduce((s, [, v]) => s + v.total, 0);
    return { aggregated, allFeatures, grandTotal };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return aggregated.filter(([, data]) => {
      if (q && !(
        data.email.toLowerCase().includes(q) ||
        (data.name ?? "").toLowerCase().includes(q)
      )) return false;
      if (featureFilter !== "all" && !(data.byFeature[featureFilter] > 0)) return false;
      return true;
    });
  }, [aggregated, search, featureFilter]);

  const hasFilters = search || featureFilter !== "all";

  const featureTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [, data] of aggregated) {
      for (const [feat, amt] of Object.entries(data.byFeature)) {
        totals[feat] = (totals[feat] ?? 0) + amt;
      }
    }
    return totals;
  }, [aggregated]);

  return (
    <div className="space-y-4">
      {/* Feature breakdown summary */}
      {allFeatures.length > 0 && (
        <div className={`grid gap-3 ${allFeatures.length <= 2 ? "grid-cols-2" : allFeatures.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
          {allFeatures.map((feat) => (
            <button
              key={feat}
              onClick={() => setFeatureFilter(featureFilter === feat ? "all" : feat)}
              className={`rounded-lg border p-4 text-left transition-all hover:bg-muted/30 ${
                featureFilter === feat ? "ring-2 ring-primary ring-offset-1 border-primary/40" : "border-border"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">
                  {FEATURE_LABEL[feat] ?? feat}
                </span>
              </div>
              <div className="text-xl font-bold">{fmt(featureTotals[feat] ?? 0)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">tokens</div>
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
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

        {/* Feature filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFeatureFilter("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              featureFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All Features
          </button>
          {allFeatures.map((feat) => (
            <button
              key={feat}
              onClick={() => setFeatureFilter(featureFilter === feat ? "all" : feat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                featureFilter === feat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {FEATURE_LABEL[feat] ?? feat}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setFeatureFilter("all"); }}
            className="flex items-center gap-1 text-xs h-9 px-3 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {aggregated.length} users
        </span>
      </div>

      {/* Per-user table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-User Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-4 text-muted-foreground font-medium">User</th>
                  {allFeatures.map((feat) => (
                    <th key={feat} className="text-right py-2.5 px-4 text-muted-foreground font-medium">
                      {FEATURE_LABEL[feat] ?? feat}
                    </th>
                  ))}
                  <th className="text-right py-2.5 px-4 text-muted-foreground font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={allFeatures.length + 2} className="py-10 text-center text-muted-foreground text-sm">
                      {hasFilters ? (
                        <span>
                          No users match your filters.{" "}
                          <button onClick={() => { setSearch(""); setFeatureFilter("all"); }} className="text-primary hover:underline">
                            Clear filters
                          </button>
                        </span>
                      ) : "No usage data this month yet."}
                    </td>
                  </tr>
                ) : filtered.map(([userId, data]) => (
                  <tr key={userId} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <p className="font-medium">{data.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{data.email}</p>
                    </td>
                    {allFeatures.map((feat) => (
                      <td key={feat} className="py-3 px-4 text-right">
                        {data.byFeature[feat] ? (
                          <Badge variant="secondary" className="text-xs font-mono">
                            {fmt(data.byFeature[feat])}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-right">
                      <span className="font-semibold font-mono">{fmt(data.total)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 border-t border-border">
                    <td className="py-2.5 px-4 font-semibold text-xs">
                      {hasFilters ? "Filtered total" : "Grand total"}
                    </td>
                    {allFeatures.map((feat) => (
                      <td key={feat} className="py-2.5 px-4 text-right font-semibold text-xs">
                        {fmt(filtered.reduce((s, [, d]) => s + (d.byFeature[feat] ?? 0), 0))}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-right font-semibold text-xs text-primary">
                      {fmt(hasFilters
                        ? filtered.reduce((s, [, d]) => s + d.total, 0)
                        : grandTotal
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
