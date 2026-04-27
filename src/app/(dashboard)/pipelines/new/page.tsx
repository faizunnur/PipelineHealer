"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Loader2, Github, Gitlab } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface Integration {
  id: string;
  provider: "github" | "gitlab";
  provider_user: string;
}

export default function NewPipelinePage() {
  const router = useRouter();

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);

  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [repoFullName, setRepoFullName] = useState("");
  const [pipelineName, setPipelineName] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((d) => {
        setIntegrations(d.integrations ?? []);
        if (d.integrations?.length === 1) setSelectedIntegration(d.integrations[0]);
      })
      .finally(() => setLoadingIntegrations(false));
  }, []);

  // Auto-fill pipeline name from repo name
  useEffect(() => {
    if (repoFullName && !pipelineName) {
      setPipelineName(repoFullName.split("/")[1] ?? repoFullName);
    }
  }, [repoFullName, pipelineName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIntegration) {
      toast({ title: "Select an integration", variant: "destructive" });
      return;
    }
    if (!repoFullName.includes("/")) {
      toast({ title: "Invalid format", description: 'Repository must be in "owner/repo" format', variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        integrationId: selectedIntegration.id,
        provider: selectedIntegration.provider,
        repoFullName: repoFullName.trim(),
        pipelineName: pipelineName.trim() || repoFullName.split("/")[1],
        defaultBranch: defaultBranch.trim() || "main",
      }),
    });
    setSubmitting(false);

    if (res.ok) {
      toast({ title: "Pipeline added!", description: `Now monitoring ${repoFullName}` });
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
        <Card className="border-dashed text-center">
          <CardContent className="py-12">
            <GitBranch className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No integrations connected</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect a GitHub or GitLab account first.
            </p>
            <Button onClick={() => router.push("/integrations/new")}>
              Connect GitHub / GitLab
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Choose a repository to monitor for CI/CD failures
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Integration selector */}
        <div className="space-y-2">
          <Label>Integration</Label>
          <div className="space-y-2">
            {integrations.map((intg) => (
              <button
                key={intg.id}
                type="button"
                onClick={() => setSelectedIntegration(intg)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors
                  ${selectedIntegration?.id === intg.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50"
                  }`}
              >
                {intg.provider === "github" ? (
                  <Github className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <Gitlab className="w-5 h-5 flex-shrink-0 text-orange-500" />
                )}
                <div>
                  <p className="font-medium text-sm">{intg.provider_user}</p>
                  <p className="text-xs text-muted-foreground capitalize">{intg.provider}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Repo name */}
        <div className="space-y-2">
          <Label htmlFor="repo">Repository</Label>
          <Input
            id="repo"
            placeholder="owner/repository-name"
            value={repoFullName}
            onChange={(e) => {
              setRepoFullName(e.target.value);
              setPipelineName(""); // reset so auto-fill can re-run
            }}
            required
          />
          <p className="text-xs text-muted-foreground">
            Exactly as it appears on GitHub/GitLab, e.g. <code>faizunRBAI/my-app</code>
          </p>
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
          <p className="text-xs text-muted-foreground">
            Display name — defaults to the repo name
          </p>
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
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !selectedIntegration} className="flex-1">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : "Add Pipeline"}
          </Button>
        </div>
      </form>

      <Card className="bg-muted/30 border-muted">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">How it works</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <CardDescription className="text-xs space-y-1">
            <p>1. Add the repository here to register it for monitoring.</p>
            <p>2. Set up a webhook on the repo pointing to your webhook URL (shown on the Integrations page).</p>
            <p>3. When a pipeline fails, PipelineHealer automatically creates a healing event with an AI-proposed fix.</p>
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
