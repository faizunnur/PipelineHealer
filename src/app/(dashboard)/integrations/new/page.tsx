"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Github, Gitlab, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type Provider = "github" | "gitlab";

const providerInfo = {
  github: {
    icon: Github,
    name: "GitHub",
    tokenLabel: "Personal Access Token",
    tokenHelp:
      "Needs: repo, workflow permissions. Create at github.com/settings/tokens",
    color: "border-border hover:border-gray-400",
    selectedColor: "border-primary bg-primary/5",
  },
  gitlab: {
    icon: Gitlab,
    name: "GitLab",
    tokenLabel: "Personal Access Token",
    tokenHelp:
      "Needs: api, read_repository, write_repository. Create in GitLab User Settings.",
    color: "border-border hover:border-orange-400",
    selectedColor: "border-orange-500 bg-orange-500/5",
  },
};

export default function NewIntegrationPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>("github");
  const [token, setToken] = useState("");
  const [providerUser, setProviderUser] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, token, providerUser }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      toast({
        title: "Integration added!",
        description:
          "Now add a webhook to your GitHub/GitLab repository to start monitoring.",
      });
      router.push("/integrations");
    } else {
      toast({
        title: "Failed to add integration",
        description: data.error,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/integrations">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Add Integration</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Provider selection */}
        <div>
          <Label className="mb-3 block">Select Provider</Label>
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(providerInfo) as [Provider, typeof providerInfo.github][]).map(
              ([key, info]) => {
                const Icon = info.icon;
                const selected = provider === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProvider(key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selected ? info.selectedColor : info.color
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-6 h-6 ${key === "gitlab" ? "text-orange-500" : ""}`}
                      />
                      <span className="font-medium">{info.name}</span>
                    </div>
                    {selected && (
                      <CheckCircle2 className="w-4 h-4 text-primary mt-2" />
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="providerUser">
            {provider === "github" ? "GitHub Username" : "GitLab Username"}
          </Label>
          <Input
            id="providerUser"
            type="text"
            placeholder={
              provider === "github" ? "octocat" : "gitlab-username"
            }
            value={providerUser}
            onChange={(e) => setProviderUser(e.target.value)}
            required
          />
        </div>

        {/* Token */}
        <div className="space-y-2">
          <Label htmlFor="token">
            {providerInfo[provider].tokenLabel}
          </Label>
          <div className="relative">
            <Input
              id="token"
              type={showToken ? "text" : "password"}
              placeholder={`ghp_...` }
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {providerInfo[provider].tokenHelp}
          </p>
          <p className="text-xs text-primary/70 flex items-center gap-1">
            🔒 Encrypted with AES-256 before storage. Your token is never stored in plaintext.
          </p>
        </div>

        {/* Webhook instructions */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">After connecting:</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            {provider === "github" ? (
              <>
                <p>1. Go to your GitHub repo → Settings → Webhooks → Add webhook</p>
                <p>2. Set Payload URL to: <code className="bg-background px-1 rounded">{`<your-app-url>`}/api/webhooks/github</code></p>
                <p>3. Content type: <code className="bg-background px-1 rounded">application/json</code></p>
                <p>4. Secret: Copy the webhook secret shown on the Integrations page</p>
                <p>5. Events: Select "Workflow jobs" and "Workflow runs"</p>
              </>
            ) : (
              <>
                <p>1. Go to your GitLab repo → Settings → Webhooks → Add new webhook</p>
                <p>2. Set URL to: <code className="bg-background px-1 rounded">{`<your-app-url>`}/api/webhooks/gitlab</code></p>
                <p>3. Secret token: Copy the webhook secret from the Integrations page</p>
                <p>4. Triggers: Select "Pipeline events" and "Job events"</p>
              </>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </>
          ) : (
            `Connect ${providerInfo[provider].name}`
          )}
        </Button>
      </form>
    </div>
  );
}
