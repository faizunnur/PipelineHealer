"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Loader2, Github, Gitlab, Search, Lock, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Integration {
  id: string;
  provider: "github" | "gitlab";
  provider_user: string;
}

interface Repo {
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  description: string | null;
}

export default function NewPipelinePage() {
  const router = useRouter();

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [showRepoList, setShowRepoList] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  const [pipelineName, setPipelineName] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load integrations
  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((d) => {
        const list: Integration[] = d.integrations ?? [];
        setIntegrations(list);
        if (list.length === 1) setSelectedIntegration(list[0]);
      })
      .finally(() => setLoadingIntegrations(false));
  }, []);

  // Load repos when integration changes
  useEffect(() => {
    if (!selectedIntegration) return;
    setLoadingRepos(true);
    setRepos([]);
    setSelectedRepo(null);
    fetch(`/api/repos?integrationId=${selectedIntegration.id}`)
      .then((r) => r.json())
      .then((d) => setRepos(d.repos ?? []))
      .catch(() => toast({ title: "Failed to load repos", variant: "destructive" }))
      .finally(() => setLoadingRepos(false));
  }, [selectedIntegration]);

  function selectRepo(repo: Repo) {
    setSelectedRepo(repo);
    setPipelineName(repo.name);
    setDefaultBranch(repo.default_branch);
    setShowRepoList(false);
    setRepoSearch("");
  }

  const filteredRepos = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(repoSearch.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIntegration || !selectedRepo) return;

    setSubmitting(true);
    const res = await fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        integrationId: selectedIntegration.id,
        provider: selectedIntegration.provider,
        repoFullName: selectedRepo.full_name,
        pipelineName: pipelineName.trim() || selectedRepo.name,
        defaultBranch: defaultBranch.trim() || selectedRepo.default_branch,
      }),
    });
    setSubmitting(false);

    if (res.ok) {
      toast({ title: "Pipeline added!", description: `Now monitoring ${selectedRepo.full_name}` });
      router.push("/pipelines");
      router.refresh();
    } else {
      const { error } = await res.json().catch(() => ({}));
      toast({ title: "Failed to add pipeline", description: error ?? "Something went wrong", variant: "destructive" });
    }
  }

  if (loadingIntegrations) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="p-6 max-w-lg">
        <div className="border border-dashed rounded-xl p-12 text-center space-y-3">
          <GitBranch className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
          <p className="font-medium">No integrations connected</p>
          <p className="text-sm text-muted-foreground">Connect a GitHub or GitLab account first.</p>
          <Button onClick={() => router.push("/integrations/new")}>Connect GitHub / GitLab</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose a repository to monitor for CI/CD failures</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Integration selector (only shown if multiple) */}
        {integrations.length > 1 && (
          <div className="space-y-2">
            <Label>Account</Label>
            <div className="space-y-2">
              {integrations.map((intg) => (
                <button
                  key={intg.id}
                  type="button"
                  onClick={() => setSelectedIntegration(intg)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                    selectedIntegration?.id === intg.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  {intg.provider === "github" ? <Github className="w-5 h-5 flex-shrink-0" /> : <Gitlab className="w-5 h-5 flex-shrink-0 text-orange-500" />}
                  <div>
                    <p className="font-medium text-sm">{intg.provider_user}</p>
                    <p className="text-xs text-muted-foreground capitalize">{intg.provider}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Repo picker */}
        <div className="space-y-2">
          <Label>Repository</Label>
          <div className="relative">
            <button
              type="button"
              disabled={!selectedIntegration || loadingRepos}
              onClick={() => setShowRepoList((v) => !v)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors",
                !selectedRepo ? "text-muted-foreground" : "text-foreground",
                "border-border hover:border-muted-foreground/50 bg-background"
              )}
            >
              {loadingRepos ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Loading repositories…</>
              ) : selectedRepo ? (
                <>
                  {selectedRepo.private ? <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  <span className="flex-1 truncate">{selectedRepo.full_name}</span>
                  {selectedRepo.language && <span className="text-xs text-muted-foreground">{selectedRepo.language}</span>}
                </>
              ) : (
                <span>Select a repository…</span>
              )}
              <ChevronDown className="w-4 h-4 flex-shrink-0 ml-auto" />
            </button>

            {showRepoList && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted rounded-md outline-none"
                      placeholder="Search repositories…"
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {filteredRepos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No repositories found</p>
                  ) : (
                    filteredRepos.map((r) => (
                      <button
                        key={r.full_name}
                        type="button"
                        onClick={() => selectRepo(r)}
                        className="flex items-start gap-2.5 w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                      >
                        {r.private ? <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" /> : <Globe className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.full_name}</p>
                          {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
                        </div>
                        {r.language && <span className="text-xs text-muted-foreground flex-shrink-0">{r.language}</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {showRepoList && <div className="fixed inset-0 z-40" onClick={() => setShowRepoList(false)} />}
        </div>

        {/* Pipeline name */}
        <div className="space-y-2">
          <Label htmlFor="name">Pipeline name</Label>
          <Input
            id="name"
            placeholder="my-app"
            value={pipelineName}
            onChange={(e) => setPipelineName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Display name — auto-filled from repo name</p>
        </div>

        {/* Default branch */}
        <div className="space-y-2">
          <Label htmlFor="branch">Default branch</Label>
          <Input
            id="branch"
            placeholder="main"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Auto-filled from repository default branch</p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={submitting || !selectedIntegration || !selectedRepo} className="flex-1">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : "Add Pipeline"}
          </Button>
        </div>
      </form>

      <div className="rounded-xl bg-muted/30 border border-muted p-4 space-y-1.5">
        <p className="text-sm font-medium">Next steps</p>
        <p className="text-xs text-muted-foreground">1. Add the pipeline here to register it for monitoring.</p>
        <p className="text-xs text-muted-foreground">2. Set up a webhook on the repo using the URL shown on the Integrations page.</p>
        <p className="text-xs text-muted-foreground">3. When a pipeline fails, PipelineHealer creates an AI-proposed fix automatically.</p>
      </div>
    </div>
  );
}
