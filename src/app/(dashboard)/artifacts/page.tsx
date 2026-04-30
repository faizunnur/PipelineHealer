"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Loader2, Plus, Trash2, ExternalLink, RefreshCw, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Pipeline = { id: string; repo_full_name: string; provider: string };
type Artifact = {
  id: string;
  pipeline_id: string;
  run_id: string | null;
  name: string;
  type: string;
  url: string | null;
  version: string | null;
  size_bytes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  pipelines: Pipeline | null;
};

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  docker:          { label: "Docker",         color: "text-blue-400",   bg: "bg-blue-400/10" },
  npm:             { label: "npm",            color: "text-red-400",    bg: "bg-red-400/10" },
  s3:              { label: "S3",             color: "text-orange-400", bg: "bg-orange-400/10" },
  "github-release":{ label: "GH Release",    color: "text-purple-400", bg: "bg-purple-400/10" },
  pypi:            { label: "PyPI",           color: "text-yellow-400", bg: "bg-yellow-400/10" },
  other:           { label: "Other",          color: "text-muted-foreground", bg: "bg-muted" },
};

function fmtSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState({
    pipeline_id: "", name: "", type: "docker",
    url: "", version: "", size_bytes: "", metadata: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, pRes] = await Promise.all([
      fetch(`/api/artifacts${filterType !== "all" ? `?type=${filterType}` : ""}`),
      fetch("/api/pipelines"),
    ]);
    if (aRes.ok) {
      const d = await aRes.json();
      setArtifacts(d.artifacts ?? []);
    }
    if (pRes.ok) {
      const d = await pRes.json();
      setPipelines(d.pipelines ?? []);
    }
    setLoading(false);
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  async function createArtifact() {
    let metadata = {};
    try { metadata = form.metadata ? JSON.parse(form.metadata) : {}; } catch { /* ignore */ }
    const res = await fetch("/api/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        size_bytes: form.size_bytes ? parseInt(form.size_bytes) : null,
        metadata,
      }),
    });
    if (res.ok) {
      setShowNew(false);
      setForm({ pipeline_id: "", name: "", type: "docker", url: "", version: "", size_bytes: "", metadata: "" });
      await load();
    }
  }

  async function deleteArtifact(id: string) {
    setDeleting(id);
    await fetch(`/api/artifacts/${id}`, { method: "DELETE" });
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
    setDeleting(null);
  }

  // Stats
  const totalSize = artifacts.reduce((s, a) => s + (a.size_bytes ?? 0), 0);
  const byType = Object.entries(
    artifacts.reduce<Record<string, number>>((acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> Artifacts
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Docker images, npm packages, S3 files, GitHub releases, and more
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Artifact
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold">{artifacts.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total Artifacts</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold">{fmtSize(totalSize) ?? "0 B"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total Size</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold">{new Set(artifacts.map((a) => a.pipeline_id)).size}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Pipelines</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold">{byType.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Artifact Types</div>
        </CardContent></Card>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {["all", ...Object.keys(TYPE_CONFIG)].map((t) => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${filterType === t ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}>
            {t === "all" ? "All" : TYPE_CONFIG[t]?.label ?? t}
          </button>
        ))}
      </div>

      {/* Add artifact modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Artifact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select value={form.pipeline_id} onChange={(e) => setForm({ ...form, pipeline_id: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background">
                <option value="">Select pipeline…</option>
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.repo_full_name}</option>)}
              </select>
              <input placeholder="Artifact name (e.g. myapp:latest)" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background" />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background">
                <option value="docker">Docker</option>
                <option value="npm">npm</option>
                <option value="s3">S3</option>
                <option value="github-release">GitHub Release</option>
                <option value="pypi">PyPI</option>
                <option value="other">Other</option>
              </select>
              <input placeholder="URL (optional)" value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background" />
              <input placeholder="Version / tag (optional)" value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background" />
              <input placeholder="Size in bytes (optional)" type="number" value={form.size_bytes}
                onChange={(e) => setForm({ ...form, size_bytes: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background" />
              <textarea placeholder='Metadata JSON (optional, e.g. {"tag":"v1.0"})' value={form.metadata} rows={2}
                onChange={(e) => setForm({ ...form, metadata: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background resize-none font-mono" />
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={createArtifact} disabled={!form.pipeline_id || !form.name} className="flex-1">Add</Button>
                <Button size="sm" variant="outline" onClick={() => setShowNew(false)} className="flex-1">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : artifacts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No artifacts yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Artifacts are automatically tracked when pipelines publish Docker images, npm packages, or GitHub releases.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {artifacts.map((art) => {
            const tc = TYPE_CONFIG[art.type] ?? TYPE_CONFIG.other;
            return (
              <Card key={art.id} className="group">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tc.bg} ${tc.color}`}>
                      {tc.label}
                    </span>
                    <button onClick={() => deleteArtifact(art.id)}
                      disabled={deleting === art.id}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                      {deleting === art.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div>
                    <p className="font-medium text-sm truncate">{art.name}</p>
                    {art.version && <p className="text-xs text-muted-foreground">v{art.version}</p>}
                  </div>

                  <p className="text-xs text-muted-foreground truncate">
                    {art.pipelines?.repo_full_name ?? art.pipeline_id}
                  </p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>{fmtSize(art.size_bytes) ?? "—"}</span>
                    <span>{fmtDate(art.created_at)}</span>
                  </div>

                  {art.url && (
                    <a href={art.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" /> View artifact
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
