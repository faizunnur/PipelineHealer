"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Bot, User, Loader2, CheckCircle2,
  Github, Gitlab, Pencil, Trash2, AlertTriangle, Eye, EyeOff, KeyRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type Profile = {
  full_name: string | null;
  email: string;
  approval_mode: string;
  tokens_used: number;
  token_budget: number;
  role: string;
};

type Integration = {
  id: string;
  provider: "github" | "gitlab";
  provider_user: string;
  is_active: boolean;
  created_at: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");

  // Credentials state
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editToken, setEditToken] = useState("");
  const [editUser, setEditUser] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [credSaving, setCredSaving] = useState(false);

  // Account deletion state
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/integrations").then((r) => r.json()),
    ]).then(([profileRes, intRes]) => {
      if (profileRes.profile) {
        setProfile(profileRes.profile);
        setAutoApprove(profileRes.profile.approval_mode === "auto");
        setFullName(profileRes.profile.full_name ?? "");
      }
      setIntegrations(intRes.integrations ?? []);
      setLoading(false);
    });
  }, []);

  async function handleApprovalModeChange(checked: boolean) {
    setAutoApprove(checked);
    const res = await fetch("/api/settings/approval-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_mode: checked ? "auto" : "manual" }),
    });
    if (res.ok) {
      toast({ title: `Approval mode: ${checked ? "Auto" : "Manual"}` });
    } else {
      setAutoApprove(!checked);
      toast({ title: "Failed to update", variant: "destructive" });
    }
  }

  async function saveProfile() {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Profile updated!" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  }

  function startEdit(integration: Integration) {
    setEditingId(integration.id);
    setEditUser(integration.provider_user);
    setEditToken("");
    setShowToken(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditToken("");
    setEditUser("");
  }

  async function saveCredential(id: string) {
    if (!editToken && !editUser) {
      toast({ title: "Enter a new token or username", variant: "destructive" });
      return;
    }
    setCredSaving(true);
    const res = await fetch(`/api/integrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editToken ? { token: editToken } : {}),
        ...(editUser ? { provider_user: editUser } : {}),
      }),
    });
    setCredSaving(false);
    if (res.ok) {
      const { integration } = await res.json();
      setIntegrations((prev) =>
        prev.map((i) => (i.id === id ? { ...i, provider_user: integration.provider_user } : i))
      );
      cancelEdit();
      toast({ title: "Credential updated" });
    } else {
      const { error } = await res.json();
      toast({ title: "Update failed", description: error, variant: "destructive" });
    }
  }

  async function deleteIntegration(id: string, provider: string) {
    if (!confirm(`Remove ${provider} integration? Monitoring for associated pipelines will stop.`)) return;
    const res = await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Integration removed" });
    } else {
      toast({ title: "Failed to remove", variant: "destructive" });
    }
  }

  async function deleteAccount() {
    if (confirmDelete !== profile?.email) {
      toast({ title: "Email doesn't match", variant: "destructive" });
      return;
    }
    setDeleting(true);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/login");
    } else {
      const { error } = await res.json();
      toast({ title: "Failed to delete account", description: error, variant: "destructive" });
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tokenPercent = profile
    ? Math.round((profile.tokens_used / profile.token_budget) * 100)
    : 0;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account and pipeline preferences
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled className="text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <Button onClick={saveProfile} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-4 h-4" />
            Credentials
          </CardTitle>
          <CardDescription>Manage your GitHub and GitLab API tokens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrations.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No integrations connected.{" "}
              <a href="/integrations/new" className="text-primary hover:underline">Add one</a>.
            </p>
          )}
          {integrations.map((integration) => (
            <div key={integration.id} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {integration.provider === "github" ? (
                    <Github className="w-4 h-4" />
                  ) : (
                    <Gitlab className="w-4 h-4 text-orange-500" />
                  )}
                  <span className="font-medium text-sm capitalize">{integration.provider}</span>
                  <span className="text-muted-foreground text-sm">@{integration.provider_user}</span>
                  <Badge variant={integration.is_active ? "success" : "secondary"} className="text-xs">
                    {integration.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {editingId !== integration.id && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(integration)}
                      className="h-7 px-2"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteIntegration(integration.id, integration.provider)}
                      className="h-7 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              {editingId === integration.id && (
                <div className="space-y-3 pt-1 border-t border-border">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Username / Account</Label>
                    <Input
                      value={editUser}
                      onChange={(e) => setEditUser(e.target.value)}
                      placeholder="e.g. octocat"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      New {integration.provider === "github" ? "Personal Access Token" : "API Token"}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showToken ? "text" : "password"}
                        value={editToken}
                        onChange={(e) => setEditToken(e.target.value)}
                        placeholder="Leave blank to keep existing token"
                        className="h-8 text-sm pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => saveCredential(integration.id)}
                      disabled={credSaving}
                      className="h-7 text-xs"
                    >
                      {credSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancelEdit}
                      disabled={credSaving}
                      className="h-7 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Auto-Healing Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-4 h-4" />
            Auto-Healing Mode
          </CardTitle>
          <CardDescription>
            Control how AI-generated fixes are applied to your pipelines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-approve" className="text-sm font-medium">
                  Auto-Approve Fixes
                </Label>
                <Badge variant={autoApprove ? "success" : "secondary"} className="text-xs">
                  {autoApprove ? "ON" : "OFF"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {autoApprove
                  ? "Fixes are applied immediately without your review. Use with caution."
                  : "You review and approve each fix before it's applied. Recommended."}
              </p>
            </div>
            <Switch
              id="auto-approve"
              checked={autoApprove}
              onCheckedChange={handleApprovalModeChange}
            />
          </div>
          {autoApprove && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning">
              ⚠ Auto-approve mode is active. AI fixes will be committed directly to your repositories.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4" />
            AI Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Monthly Token Usage</span>
            <span className="font-mono">
              {profile?.tokens_used.toLocaleString()} / {profile?.token_budget.toLocaleString()}
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                tokenPercent > 80 ? "bg-destructive" : tokenPercent > 60 ? "bg-warning" : "bg-primary"
              }`}
              style={{ width: `${Math.min(tokenPercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {tokenPercent}% used · Resets on the 1st of each month
          </p>
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Security</p>
              <p>All API tokens are encrypted with AES-256-GCM before storage.</p>
              <p>Tokens are never logged or transmitted in plaintext.</p>
              <p>Webhook signatures are verified with HMAC-SHA256.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-xs text-muted-foreground space-y-1">
            <p>Deleting your account will permanently remove:</p>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              <li>Your profile and all account data</li>
              <li>All connected integrations and credentials</li>
              <li>All pipelines, runs, and healing events</li>
              <li>All reports, templates, and settings</li>
            </ul>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">
              Type your email address{" "}
              <span className="font-mono text-muted-foreground">{profile?.email}</span>{" "}
              to confirm
            </Label>
            <Input
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={profile?.email ?? ""}
              className="border-destructive/30 focus-visible:ring-destructive/30"
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={deleteAccount}
            disabled={deleting || confirmDelete !== profile?.email}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete My Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
