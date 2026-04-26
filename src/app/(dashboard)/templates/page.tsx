"use client";

import { useState, useEffect } from "react";
import { LayoutTemplate, Search, Star, Download, Plus, Github, Gitlab, Loader2, Code2, Tag, X } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", category: "ci", provider: "github", content: "", tags: "",
  });

  useEffect(() => {
    // Seed official templates on first load
    fetch("/api/templates/seed").catch(() => {});
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [category, search]);

  async function loadTemplates() {
    setLoading(true);
    const params = new URLSearchParams({ category });
    if (search) params.set("search", search);
    const res = await fetch(`/api/templates?${params}`);
    const data = await res.json();
    setTemplates(data.templates ?? []);
    setLoading(false);
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
      toast({ title: "Template submitted!", description: "Your template has been added to the marketplace." });
      setShowSubmit(false);
      setForm({ name: "", description: "", category: "ci", provider: "github", content: "", tags: "" });
      loadTemplates();
    } else {
      const d = await res.json();
      toast({ title: "Failed", description: d.error, variant: "destructive" });
    }
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-primary" /> Template Marketplace
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ready-to-use pipeline templates — copy, customize, and ship
          </p>
        </div>
        <Button onClick={() => setShowSubmit(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Submit Template
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary" /> {selected.name}
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                  <X className="w-4 h-4" />
                </Button>
                <Button size="sm" className="gap-2" onClick={() => handleCopy(selected)}>
                  <Download className="w-4 h-4" /> Copy Template
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

      {/* Submit modal */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Submit a Template</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowSubmit(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
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
                    Submit Template
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
