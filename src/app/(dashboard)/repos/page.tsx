"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Github, Gitlab, GitBranch, FilePlus, Trash2, Save,
  Loader2, ChevronDown, AlertTriangle, Search, Lock, Globe, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileTree, type TreeItem } from "@/components/repos/FileTree";
import { CodeEditor } from "@/components/repos/CodeEditor";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

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

interface Branch {
  name: string;
  protected: boolean;
}

interface FileData {
  content: string;
  sha: string;
  size: number;
  name: string;
  path: string;
  isBinary: boolean;
}

// ── Main Component ────────────────────────────────────────────────────────────

function RepoBrowserContent() {
  const router = useRouter();
  const sp = useSearchParams();

  // URL-driven state
  const integrationId = sp.get("integration") ?? "";
  const repoFullName = sp.get("repo") ?? "";
  const currentRef = sp.get("ref") ?? "";
  const currentFilePath = sp.get("path") ?? "";

  // Integrations
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);

  // Repos
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [showRepoList, setShowRepoList] = useState(false);

  // Branches
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showBranchList, setShowBranchList] = useState(false);

  // File tree
  const [rootItems, setRootItems] = useState<TreeItem[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  // Editor
  const [file, setFile] = useState<FileData | null>(null);
  const [editContent, setEditContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Dialogs
  const [showCommit, setShowCommit] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [showNewFile, setShowNewFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── URL helpers ─────────────────────────────────────────────────────────────

  function navigate(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) next.set(k, v); else next.delete(k);
    });
    router.push(`/repos?${next.toString()}`);
  }

  // ── Load integrations on mount ───────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((d) => {
        const list: Integration[] = d.integrations ?? [];
        setIntegrations(list);
        if (!integrationId && list.length === 1) {
          navigate({ integration: list[0].id });
        }
      })
      .finally(() => setLoadingIntegrations(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load repos when integration changes ──────────────────────────────────────

  useEffect(() => {
    if (!integrationId) return;
    setLoadingRepos(true);
    setRepos([]);
    fetch(`/api/repos?integrationId=${integrationId}`)
      .then((r) => r.json())
      .then((d) => setRepos(d.repos ?? []))
      .catch(() => toast({ title: "Failed to load repos", variant: "destructive" }))
      .finally(() => setLoadingRepos(false));
  }, [integrationId]);

  // ── Load branches + root tree when repo changes ──────────────────────────────

  useEffect(() => {
    if (!integrationId || !repoFullName) return;
    const selectedRepo = repos.find((r) => r.full_name === repoFullName);

    // Fetch branches
    fetch(`/api/repos/branches?integrationId=${integrationId}&repo=${encodeURIComponent(repoFullName)}`)
      .then((r) => r.json())
      .then((d) => {
        setBranches(d.branches ?? []);
        // Set default branch in URL if not set
        if (!currentRef && selectedRepo) {
          navigate({ ref: selectedRepo.default_branch });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, repoFullName]);

  // ── Load root tree when branch changes ───────────────────────────────────────

  useEffect(() => {
    if (!integrationId || !repoFullName || !currentRef) return;
    setLoadingTree(true);
    setRootItems([]);
    fetch(
      `/api/repos/tree?integrationId=${integrationId}&repo=${encodeURIComponent(repoFullName)}&path=&ref=${encodeURIComponent(currentRef)}`
    )
      .then((r) => r.json())
      .then((d) => setRootItems(d.items ?? []))
      .catch(() => toast({ title: "Failed to load file tree", variant: "destructive" }))
      .finally(() => setLoadingTree(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, repoFullName, currentRef, treeRefreshKey]);

  // ── Load file when path changes ───────────────────────────────────────────────

  useEffect(() => {
    if (!integrationId || !repoFullName || !currentRef || !currentFilePath) {
      setFile(null);
      return;
    }
    setLoadingFile(true);
    setIsDirty(false);
    fetch(
      `/api/repos/file?integrationId=${integrationId}&repo=${encodeURIComponent(repoFullName)}&path=${encodeURIComponent(currentFilePath)}&ref=${encodeURIComponent(currentRef)}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setFile(d);
        setEditContent(d.content);
      })
      .catch((e) => toast({ title: "Failed to load file", description: e.message, variant: "destructive" }))
      .finally(() => setLoadingFile(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, repoFullName, currentRef, currentFilePath]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleFileClick = useCallback((path: string) => {
    navigate({ path });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  async function handleSave() {
    if (!file || !isDirty || !commitMessage.trim()) return;
    setSaving(true);
    const res = await fetch("/api/repos/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        integrationId,
        repo: repoFullName,
        path: currentFilePath,
        content: editContent,
        sha: file.sha,
        message: commitMessage,
        branch: currentRef,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Committed!", description: commitMessage });
      setShowCommit(false);
      setCommitMessage("");
      setIsDirty(false);
      // Reload file to get new sha
      navigate({ path: currentFilePath });
    } else {
      const { error } = await res.json().catch(() => ({}));
      toast({ title: "Commit failed", description: error, variant: "destructive" });
    }
  }

  async function handleCreateFile() {
    if (!newFilePath.trim()) return;
    setCreatingFile(true);
    const res = await fetch("/api/repos/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        integrationId,
        repo: repoFullName,
        path: newFilePath.trim(),
        content: "",
        message: `chore: create ${newFilePath.trim()}`,
        branch: currentRef,
      }),
    });
    setCreatingFile(false);
    if (res.ok) {
      toast({ title: "File created", description: newFilePath });
      setShowNewFile(false);
      setNewFilePath("");
      setTreeRefreshKey((k) => k + 1);
      navigate({ path: newFilePath.trim() });
    } else {
      const { error } = await res.json().catch(() => ({}));
      toast({ title: "Create failed", description: error, variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!file) return;
    setDeleting(true);
    const res = await fetch("/api/repos/file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        integrationId,
        repo: repoFullName,
        path: currentFilePath,
        sha: file.sha,
        message: `chore: delete ${currentFilePath}`,
        branch: currentRef,
      }),
    });
    setDeleting(false);
    if (res.ok) {
      toast({ title: "File deleted" });
      setShowDeleteConfirm(false);
      setTreeRefreshKey((k) => k + 1);
      navigate({ path: "" });
    } else {
      const { error } = await res.json().catch(() => ({}));
      toast({ title: "Delete failed", description: error, variant: "destructive" });
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const selectedIntegration = integrations.find((i) => i.id === integrationId);
  const selectedRepo = repos.find((r) => r.full_name === repoFullName);
  const filteredRepos = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(repoSearch.toLowerCase())
  );

  const breadcrumbs = currentFilePath ? currentFilePath.split("/") : [];

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (loadingIntegrations) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <GitBranch className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
          <p className="font-medium">No integrations connected</p>
          <p className="text-sm text-muted-foreground">Connect GitHub or GitLab first</p>
          <Button onClick={() => router.push("/integrations/new")}>Connect GitHub / GitLab</Button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card flex-shrink-0 flex-wrap">

        {/* Integration selector */}
        <div className="relative">
          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted transition-colors"
            onClick={() => { setShowRepoList(false); setShowBranchList(false); }}
          >
            {selectedIntegration?.provider === "github" ? (
              <Github className="w-3.5 h-3.5" />
            ) : selectedIntegration?.provider === "gitlab" ? (
              <Gitlab className="w-3.5 h-3.5 text-orange-500" />
            ) : (
              <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span>{selectedIntegration?.provider_user ?? "Select account"}</span>
            {integrations.length > 1 && <ChevronDown className="w-3 h-3" />}
          </button>
          {integrations.length > 1 && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]">
              {integrations.map((i) => (
                <button
                  key={i.id}
                  onClick={() => navigate({ integration: i.id, repo: "", ref: "", path: "" })}
                  className={cn("flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted", i.id === integrationId && "text-primary")}
                >
                  {i.provider === "github" ? <Github className="w-3.5 h-3.5" /> : <Gitlab className="w-3.5 h-3.5 text-orange-500" />}
                  {i.provider_user}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Repo selector */}
        {integrationId && (
          <div className="relative">
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted transition-colors max-w-[200px]"
              onClick={() => { setShowRepoList((v) => !v); setShowBranchList(false); }}
            >
              {selectedRepo ? (
                <>
                  {selectedRepo.private ? <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                  <span className="truncate">{selectedRepo.full_name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{loadingRepos ? "Loading repos…" : "Select repository"}</span>
              )}
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>

            {showRepoList && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl w-72">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <input
                      className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted rounded-md outline-none"
                      placeholder="Search repositories…"
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {loadingRepos ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No repos found</p>
                  ) : (
                    filteredRepos.map((r) => (
                      <button
                        key={r.full_name}
                        onClick={() => {
                          navigate({ repo: r.full_name, ref: r.default_branch, path: "" });
                          setShowRepoList(false);
                          setRepoSearch("");
                        }}
                        className={cn(
                          "flex items-start gap-2 w-full px-3 py-2 text-left hover:bg-muted transition-colors",
                          r.full_name === repoFullName && "text-primary"
                        )}
                      >
                        {r.private ? <Lock className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" /> : <Globe className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" />}
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{r.full_name}</p>
                          {r.description && <p className="text-[10px] text-muted-foreground truncate">{r.description}</p>}
                        </div>
                        {r.language && <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">{r.language}</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Branch selector */}
        {repoFullName && (
          <div className="relative">
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted transition-colors"
              onClick={() => { setShowBranchList((v) => !v); setShowRepoList(false); }}
            >
              <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{currentRef || "branch"}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showBranchList && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl w-52 py-1 max-h-64 overflow-y-auto">
                {branches.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => { navigate({ ref: b.name, path: "" }); setShowBranchList(false); }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted",
                      b.name === currentRef && "text-primary"
                    )}
                  >
                    <GitBranch className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{b.name}</span>
                    {b.protected && <Lock className="w-3 h-3 ml-auto flex-shrink-0 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons — only shown when a repo is open */}
        {repoFullName && currentRef && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => { setTreeRefreshKey((k) => k + 1); }}
              title="Refresh tree"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => setShowNewFile(true)}
            >
              <FilePlus className="w-3 h-3" />
              New File
            </Button>

            {currentFilePath && file && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </Button>
            )}

            {isDirty && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowCommit(true)}
              >
                <Save className="w-3 h-3" />
                Commit
              </Button>
            )}
          </>
        )}
      </div>

      {/* ── Breadcrumb ── */}
      {currentFilePath && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/30 text-xs text-muted-foreground flex-shrink-0 overflow-x-auto">
          <button
            className="hover:text-foreground transition-colors flex-shrink-0"
            onClick={() => navigate({ path: "" })}
          >
            {repoFullName.split("/")[1]}
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1 flex-shrink-0">
              <span>/</span>
              <span className={i === breadcrumbs.length - 1 ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"}
                onClick={() => {
                  if (i < breadcrumbs.length - 1) {
                    navigate({ path: breadcrumbs.slice(0, i + 1).join("/") });
                  }
                }}>
                {crumb}
              </span>
            </span>
          ))}
          {isDirty && <span className="ml-2 text-yellow-500 text-[10px]">● unsaved changes</span>}
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* File tree */}
        {repoFullName && currentRef && (
          <div className="w-60 flex-shrink-0 border-r border-border overflow-y-auto bg-card">
            {loadingTree ? (
              <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading tree…
              </div>
            ) : (
              <FileTree
                key={`${repoFullName}-${currentRef}-${treeRefreshKey}`}
                integrationId={integrationId}
                repo={repoFullName}
                ref={currentRef}
                rootItems={rootItems}
                selectedFile={currentFilePath}
                onFileClick={handleFileClick}
              />
            )}
          </div>
        )}

        {/* Editor panel */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#1e1e1e]">
          {!repoFullName ? (
            <WelcomeScreen />
          ) : loadingFile ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !currentFilePath ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a file to view or edit
            </div>
          ) : file?.isBinary ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                <p className="text-sm text-muted-foreground">Binary file — cannot display</p>
              </div>
            </div>
          ) : file ? (
            <CodeEditor
              filename={file.name}
              value={editContent}
              onChange={(v) => { setEditContent(v); setIsDirty(v !== file.content); }}
            />
          ) : null}
        </div>
      </div>

      {/* ── Commit dialog ── */}
      {showCommit && (
        <Dialog onClose={() => setShowCommit(false)} title="Commit changes">
          <p className="text-xs text-muted-foreground mb-3">
            Committing <span className="font-medium text-foreground">{currentFilePath}</span> to <span className="font-medium text-foreground">{currentRef}</span>
          </p>
          <Input
            placeholder="Commit message…"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowCommit(false)}>Cancel</Button>
            <Button className="flex-1" disabled={!commitMessage.trim() || saving} onClick={handleSave}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Committing…</> : <><Save className="w-3.5 h-3.5" /> Commit</>}
            </Button>
          </div>
        </Dialog>
      )}

      {/* ── New file dialog ── */}
      {showNewFile && (
        <Dialog onClose={() => setShowNewFile(false)} title="New file">
          <p className="text-xs text-muted-foreground mb-3">Enter the path for the new file relative to the repo root.</p>
          <Input
            placeholder="e.g. .github/workflows/ci.yml"
            value={newFilePath}
            onChange={(e) => setNewFilePath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowNewFile(false)}>Cancel</Button>
            <Button className="flex-1" disabled={!newFilePath.trim() || creatingFile} onClick={handleCreateFile}>
              {creatingFile ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</> : <><FilePlus className="w-3.5 h-3.5" /> Create</>}
            </Button>
          </div>
        </Dialog>
      )}

      {/* ── Delete confirm dialog ── */}
      {showDeleteConfirm && (
        <Dialog onClose={() => setShowDeleteConfirm(false)} title="Delete file">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              Delete <span className="font-medium">{currentFilePath}</span> from <span className="font-medium">{currentRef}</span>? This cannot be undone.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" disabled={deleting} onClick={handleDelete}>
              {deleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</> : <><Trash2 className="w-3.5 h-3.5" /> Delete</>}
            </Button>
          </div>
        </Dialog>
      )}

      {/* Click-away to close dropdowns */}
      {(showRepoList || showBranchList) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowRepoList(false); setShowBranchList(false); }} />
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function WelcomeScreen() {
  return (
    <div className="flex items-center justify-center h-full text-center px-8">
      <div className="space-y-3 max-w-xs">
        <GitBranch className="w-12 h-12 text-muted-foreground mx-auto opacity-30" />
        <p className="font-medium text-muted-foreground">Select a repository</p>
        <p className="text-xs text-muted-foreground">
          Choose an account and repository from the toolbar above to browse and edit files.
        </p>
      </div>
    </div>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl p-5 w-full max-w-md shadow-2xl">
        <h3 className="font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function ReposPage() {
  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      }>
        <RepoBrowserContent />
      </Suspense>
    </div>
  );
}
