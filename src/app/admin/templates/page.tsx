"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutTemplate, Plus, Pencil, Trash2, CheckCircle2, XCircle,
  Loader2, Star, Github, Gitlab, X, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type Template = {
  id: string;
  name: string;
  title: string | null;
  description: string;
  category: string;
  provider: string;
  content: string;
  tags: string[];
  is_official: boolean;
  is_featured: boolean;
  status: "pending" | "approved" | "rejected";
  use_count: number;
  created_at: string;
  profiles?: { email: string; full_name: string | null } | null;
};

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const CATEGORIES = ["ci", "deploy", "docker", "release", "security", "testing", "other"];
const PROVIDERS = ["github", "gitlab", "both"];

const blankForm = {
  name: "", description: "", category: "ci", provider: "github",
  content: "", tags: "", is_official: true, is_featured: false,
};

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusTab });
    const res = await fetch(`/api/admin/templates?${params}`);
    const data = await res.json();
    setTemplates(data.templates ?? []);
    setLoading(false);
  }, [statusTab]);

  useEffect(() => { load(); }, [load]);

  const filtered = templates.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setEditing(null);
    setForm(blankForm);
    setShowForm(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description,
      category: t.category,
      provider: t.provider,
      content: t.content,
      tags: t.tags?.join(", ") ?? "",
      is_official: t.is_official,
      is_featured: t.is_featured,
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = {
      ...form,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      status: "approved",
    };

    const res = editing
      ? await fetch(`/api/admin/templates/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/admin/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    setSaving(false);
    if (res.ok) {
      toast({ title: editing ? "Template updated" : "Template created" });
      setShowForm(false);
      load();
    } else {
      const d = await res.json();
      toast({ title: "Error", description: d.error, variant: "destructive" });
    }
  }

  async function handleStatus(id: string, status: "approved" | "rejected") {
    const res = await fetch(`/api/admin/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast({ title: status === "approved" ? "Template approved" : "Template rejected" });
      load();
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Template deleted" });
      load();
    } else {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  const statusBadge = (s: string) => {
    if (s === "approved") return <Badge variant="success" className="text-xs">Approved</Badge>;
    if (s === "pending") return <Badge variant="warning" className="text-xs">Pending</Badge>;
    return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6" /> Templates
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage official templates and review user contributions
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Add Template
        </Button>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${statusTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
            >
              {tab.label}
              {tab.value === "pending" && templates.filter((t) => t.status === "pending").length > 0 && (
                <span className="ml-1.5 bg-warning text-warning-foreground rounded-full px-1.5 py-0.5 text-xs">
                  {templates.filter((t) => t.status === "pending").length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-9 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No templates found
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">By</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Uses</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {t.is_official && <Star className="w-3.5 h-3.5 fill-warning text-warning flex-shrink-0" />}
                      <span className="font-medium line-clamp-1">{t.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs capitalize">{t.category}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs">
                      {t.provider === "github" ? <Github className="w-3.5 h-3.5" /> : <Gitlab className="w-3.5 h-3.5 text-orange-500" />}
                      <span className="capitalize">{t.provider}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">{statusBadge(t.status)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t.profiles?.full_name ?? t.profiles?.email ?? (t.is_official ? "Official" : "—")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.use_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {t.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleStatus(t.id, "approved")}
                            className="p-1.5 rounded hover:bg-success/10 text-muted-foreground hover:text-success transition-colors"
                            title="Approve"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleStatus(t.id, "rejected")}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {t.status === "rejected" && (
                        <button
                          onClick={() => handleStatus(t.id, "approved")}
                          className="p-1.5 rounded hover:bg-success/10 text-muted-foreground hover:text-success transition-colors"
                          title="Approve"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(t)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-base">{editing ? "Edit Template" : "Add Template"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input
                    placeholder="e.g. Node.js CI with Cache"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    placeholder="node, cache, test"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description *</Label>
                <Input
                  placeholder="What this template does"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="capitalize">{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Provider *</Label>
                  <select
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p} className="capitalize">{p === "github" ? "GitHub Actions" : p === "gitlab" ? "GitLab CI" : "Both"}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_official}
                    onChange={(e) => setForm({ ...form, is_official: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Official template
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Featured
                </label>
              </div>

              <div className="space-y-2">
                <Label>Pipeline YAML *</Label>
                <textarea
                  rows={16}
                  required
                  placeholder="Paste your pipeline YAML here..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-xs font-mono resize-y"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? "Save Changes" : "Create Template"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
