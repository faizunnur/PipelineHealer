"use client";

import { useState, useEffect } from "react";
import {
  LayoutTemplate, Search, Star, Download, Plus, Github, Gitlab,
  Loader2, Code2, Tag, X, Rocket, Copy, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Template = {
  id: string; name: string; description: string; category: string;
  provider: string; content: string; tags: string[]; use_count: number;
  is_official: boolean; author_id: string | null;
};

type Pipeline = {
  id: string; repo_full_name: string; provider: string; default_branch: string;
};

const CATEGORIES = [
  { value: "all", label: "All Templates" },
  { value: "ci", label: "CI / Testing" },
  { value: "deploy", label: "Deploy" },
  { value: "docker", label: "Docker" },
  { value: "release", label: "Release" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

const PROVIDER_ICON: Record<string, React.ReactNode> = {
  github: <Github className="w-3.5 h-3.5" />,
  gitlab: <Gitlab className="w-3.5 h-3.5" />,
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Template | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyTemplate, setApplyTemplate] = useState<Template | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [applyPipelineId, setApplyPipelineId] = useState("");
  const [applyFileName, setApplyFileName] = useState("");
  const [applyMode, setApplyMode] = useState<"auto" | "manual">("auto");
  const [copiedManual, setCopiedManual] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", category: "ci", provider: "github", content: "", tags: "",
  });

  useEffect(() => {
    fetch("/api/templates/seed").catch(() => {});
  }, []);

  useEffect(() => { loadTemplates(); }, [category, search]);

  async function loadTemplates() {
    setLoading(true);
    const params = new URLSearchParams({ category });
    if (search) params.set("search", search);
    const res = await fetch(`/api/templates?${params}`);
    const data = await res.json();
    setTemplates(data.templates ?? []);
    setLoading(false);
  }

  async function loadPipelines() {
    const res = await fetch("/api/pipelines");
    const data = await res.json();
    setPipelines(data.pipelines ?? []);
  }

  function openApply(t: Template) {
    setApplyTemplate(t);
    setApplyPipelineId("");
    setApplyFileName(t.provider === "gitlab" ? ".gitlab-ci.yml" : `${t.name.toLowerCase().replace(/\s+/g, "-")}.yml`);
    setApplyMode("auto");
    setCopiedManual(false);
    setShowApply(true);
    loadPipelines();
  }

  async function handleApply() {
    if (!applyTemplate) return;
    if (applyMode === "auto" && !applyPipelineId) {
      toast({ title: "Select a pipeline first", variant: "destructive" });
      return;
    }

    if (applyMode === "manual") {
      await navigator.clipboard.writeText(applyTemplate.content);
      setCopiedManual(true);
      toast({ title: "Copied!", description: "Paste the YAML into your repository manually." });
      return;
    }

    setApplying(true);
    const res = await fetch(`/api/templates/${applyTemplate.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineId: applyPipelineId, fileName: applyFileName, mode: "auto" }),
    });
    setApplying(false);

    if (res.ok) {
      const { filePath, branch } = await res.json();
      toast({
        title: "Template applied!",
        description: `Committed to ${filePath} on branch ${branch}.`,
      });
      setShowApply(false);
    } else {
      const d = await res.json();
      toast({ title: "Apply failed", description: d.error, variant: "destructive" });
    }
  }

  async function handleCopy(template: Template) {
    await navigator.clipboard.writeText(template.content);
    await fetch(`/api/templates?id=${template.id}`, { method: "PATCH" });
    toast({ title: "Copied to clipboard!", description: `${template.name} template copied.` });
    setTemplates((prev) => prev.map((t) => t.id === template.id
      ? { ...t, use_count: t.use_count + 1 } : t));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast({
        title: "Template submitted!",
        description: "Your template is under review and will appear once approved by an admin.",
      });
      setShowSubmit(false);
      setForm({ name: "", description: "", category: "ci", provider: "github", content: "", tags: "" });
    } else {
      const d = await res.json();
      toast({ title: "Failed", description: d.error, variant: "destructive" });
    }
  }

  const selectedPipeline = pipelines.find((p) => p.id === applyPipelineId);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-primary" /> Template Marketplace
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ready-to-use pipeline templates — apply directly to your repo or copy and customize
          </p>
        </div>
        <Button onClick={() => setShowSubmit(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Contribute Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search templates..." className="pl-9"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${category === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"}`}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <LayoutTemplate className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium">No templates found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search or category</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id}
              className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${selected?.id === t.id ? "ring-1 ring-primary/50 border-primary/30" : ""}`}
              onClick={() => setSelected(selected?.id === t.id ? null : t)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm leading-snug">{t.name}</CardTitle>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {t.is_official && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Star className="w-2.5 h-2.5 fill-warning text-warning" /> Official
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs gap-1 capitalize">
                      {PROVIDER_ICON[t.provider]} {t.provider}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                <div className="flex flex-wrap gap-1">
                  {t.tags?.slice(0, 4).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Download className="w-3 h-3" /> {t.use_count} uses
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{t.category}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview panel */}
      {selected && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary" /> {selected.name}
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                  <X className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => handleCopy(selected)}>
                  <Copy className="w-4 h-4" /> Copy
                </Button>
                <Button size="sm" className="gap-2" onClick={() => openApply(selected)}>
                  <Rocket className="w-4 h-4" /> Apply to Pipeline
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">{selected.description}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selected.tags?.map((tag) => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                  <Tag className="w-2.5 h-2.5" /> {tag}
                </span>
              ))}
            </div>
            <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto border border-border/50 whitespace-pre">
              {selected.content}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Apply to Pipeline modal */}
      {showApply && applyTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" /> Apply Template
              </h2>
              <button onClick={() => setShowApply(false)} className="p-1 rounded hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <p className="text-sm text-muted-foreground">
                Applying <strong className="text-foreground">{applyTemplate.name}</strong> to a pipeline
              </p>

              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setApplyMode("auto")}
                  className={`p-3 rounded-lg border text-left transition-colors ${applyMode === "auto" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <p className="font-medium text-sm">Automatic</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Commits the file directly to your repository
                  </p>
                </button>
                <button
                  onClick={() => setApplyMode("manual")}
                  className={`p-3 rounded-lg border text-left transition-colors ${applyMode === "manual" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <p className="font-medium text-sm">Manual Copy</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Copy YAML and add to your repo yourself
                  </p>
                </button>
              </div>

              {applyMode === "auto" && (
                <>
                  <div className="space-y-2">
                    <Label>Pipeline / Repository</Label>
                    <select
                      value={applyPipelineId}
                      onChange={(e) => {
                        setApplyPipelineId(e.target.value);
                        const p = pipelines.find((p) => p.id === e.target.value);
                        if (p?.provider === "gitlab") setApplyFileName(".gitlab-ci.yml");
                      }}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select a pipeline…</option>
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>{p.repo_full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      File name
                      {selectedPipeline?.provider === "github" && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (will be placed in <code>.github/workflows/</code>)
                        </span>
                      )}
                    </Label>
                    <Input
                      value={applyFileName}
                      onChange={(e) => setApplyFileName(e.target.value)}
                      placeholder={selectedPipeline?.provider === "github" ? "ci.yml" : ".gitlab-ci.yml"}
                    />
                  </div>

                  {selectedPipeline && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2.5">
                      Will commit to <strong>{selectedPipeline.repo_full_name}</strong> on branch{" "}
                      <strong>{selectedPipeline.default_branch}</strong>
                    </p>
                  )}
                </>
              )}

              {applyMode === "manual" && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1.5">
                  <p className="font-medium text-sm">Instructions</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Click Copy below to copy the YAML</li>
                    <li>
                      In your repo, create the file at:
                      <code className="ml-1 bg-muted px-1.5 py-0.5 rounded">
                        {applyTemplate.provider === "github"
                          ? ".github/workflows/pipeline.yml"
                          : ".gitlab-ci.yml"}
                      </code>
                    </li>
                    <li>Paste the YAML and commit</li>
                  </ol>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <Button variant="outline" onClick={() => setShowApply(false)}>Cancel</Button>
                <Button
                  onClick={handleApply}
                  disabled={applying || (applyMode === "auto" && !applyPipelineId)}
                  className="gap-2"
                >
                  {applying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
                  ) : copiedManual ? (
                    <><CheckCircle2 className="w-4 h-4" /> Copied!</>
                  ) : applyMode === "manual" ? (
                    <><Copy className="w-4 h-4" /> Copy YAML</>
                  ) : (
                    <><Rocket className="w-4 h-4" /> Apply Now</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit / Contribute modal */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Contribute a Template</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowSubmit(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Your template will be reviewed by an admin before it appears in the marketplace.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Template Name *</Label>
                    <Input placeholder="e.g. Rust CI with Cargo Cache"
                      value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags (comma-separated)</Label>
                    <Input placeholder="rust, cargo, test"
                      value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Input placeholder="Short description of what this template does"
                    value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                      {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider *</Label>
                    <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="github">GitHub Actions</option>
                      <option value="gitlab">GitLab CI</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Pipeline YAML *</Label>
                  <textarea rows={14} required
                    placeholder="Paste your pipeline YAML here..."
                    value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-xs font-mono resize-y" />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowSubmit(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting} className="gap-2">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit for Review
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
