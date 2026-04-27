"use client";

import { useState, useEffect } from "react";
import {
  Building2, Plus, Users, Crown, Shield, Eye, Loader2, Trash2, UserPlus,
  Settings, LogOut, X, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";

type Org = {
  id: string; name: string; slug: string; description: string | null;
  created_at: string; owner_id: string; role: string;
};

type Member = {
  user_id: string; role: string; joined_at: string;
  profiles: { full_name: string | null; email: string; avatar_url: string | null };
};

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  owner: { icon: <Crown className="w-3.5 h-3.5" />, color: "text-warning", label: "Owner" },
  admin: { icon: <Shield className="w-3.5 h-3.5" />, color: "text-primary", label: "Admin" },
  member: { icon: <Users className="w-3.5 h-3.5" />, color: "text-muted-foreground", label: "Member" },
  viewer: { icon: <Eye className="w-3.5 h-3.5" />, color: "text-muted-foreground", label: "Viewer" },
};

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({ name: "", slug: "", description: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", role: "member" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then(({ profile }) => {
      if (profile?.id) setCurrentUserId(profile.id);
    });
    loadOrgs();
  }, []);

  async function loadOrgs() {
    setLoading(true);
    const res = await fetch("/api/orgs");
    const data = await res.json();
    setOrgs(data.orgs ?? []);
    setLoading(false);
  }

  async function loadMembers(orgId: string) {
    setLoadingMembers(true);
    const res = await fetch(`/api/orgs/${orgId}`);
    const data = await res.json();
    setMembers(data.members ?? []);
    setLoadingMembers(false);
  }

  function selectOrg(org: Org) {
    setSelectedOrg(org);
    loadMembers(org.id);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    setSubmitting(false);
    if (res.ok) {
      toast({ title: "Organization created!" });
      setShowCreate(false);
      setCreateForm({ name: "", slug: "", description: "" });
      loadOrgs();
    } else {
      const d = await res.json();
      toast({ title: "Failed", description: d.error, variant: "destructive" });
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrg) return;
    setSubmitting(true);
    const res = await fetch(`/api/orgs/${selectedOrg.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });
    setSubmitting(false);
    if (res.ok) {
      toast({ title: "Member added!" });
      setShowInvite(false);
      setInviteForm({ email: "", role: "member" });
      loadMembers(selectedOrg.id);
    } else {
      const d = await res.json();
      toast({ title: "Failed", description: d.error, variant: "destructive" });
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!selectedOrg) return;
    const res = await fetch(`/api/orgs/${selectedOrg.id}/members?userId=${memberId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: memberId === currentUserId ? "You left the org" : "Member removed" });
      loadMembers(selectedOrg.id);
      if (memberId === currentUserId) { setSelectedOrg(null); loadOrgs(); }
    }
  }

  async function handleChangeRole(memberId: string, role: string) {
    if (!selectedOrg) return;
    await fetch(`/api/orgs/${selectedOrg.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: memberId, role }),
    });
    loadMembers(selectedOrg.id);
  }

  async function handleDeleteOrg() {
    if (!selectedOrg) return;
    if (!confirm(`Delete "${selectedOrg.name}"? This cannot be undone.`)) return;
    await fetch(`/api/orgs/${selectedOrg.id}`, { method: "DELETE" });
    toast({ title: "Organization deleted" });
    setSelectedOrg(null);
    loadOrgs();
  }

  const canManage = selectedOrg && ["owner", "admin"].includes(selectedOrg.role);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Organizations & Teams
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Collaborate with your team across shared pipelines and integrations
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Create Organization
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Org list */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Organizations</p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : orgs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No organizations yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create one to collaborate with your team</p>
              </CardContent>
            </Card>
          ) : (
            orgs.map((org) => {
              const roleCfg = ROLE_CONFIG[org.role] ?? ROLE_CONFIG.member;
              return (
                <Card key={org.id}
                  className={`cursor-pointer transition-all hover:border-primary/30 ${selectedOrg?.id === org.id ? "ring-1 ring-primary/50 border-primary/30" : ""}`}
                  onClick={() => selectOrg(org)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{org.name}</p>
                        <p className="text-xs text-muted-foreground">/{org.slug}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`${roleCfg.color}`}>{roleCfg.icon}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    {org.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{org.description}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Org detail */}
        <div className="lg:col-span-2">
          {!selectedOrg ? (
            <Card className="border-dashed h-full flex items-center justify-center min-h-64">
              <CardContent className="text-center py-12">
                <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm">Select an organization to view details</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{selectedOrg.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">/{selectedOrg.slug} · Created {formatRelativeTime(selectedOrg.created_at)}</p>
                    {selectedOrg.description && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedOrg.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {canManage && (
                      <Button size="sm" variant="outline" className="gap-1.5"
                        onClick={() => setShowInvite(true)}>
                        <UserPlus className="w-3.5 h-3.5" /> Invite
                      </Button>
                    )}
                    {selectedOrg.role === "owner" && (
                      <Button size="sm" variant="destructive" className="gap-1.5"
                        onClick={handleDeleteOrg}>
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    )}
                    {selectedOrg.role !== "owner" && (
                      <Button size="sm" variant="ghost" className="gap-1.5 text-destructive"
                        onClick={() => handleRemoveMember(currentUserId)}>
                        <LogOut className="w-3.5 h-3.5" /> Leave
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Members ({members.length})
                </p>
                {loadingMembers ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => {
                      const roleCfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.member;
                      const isMe = member.user_id === currentUserId;
                      return (
                        <div key={member.user_id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium flex-shrink-0">
                            {(member.profiles?.full_name ?? member.profiles?.email ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">
                                {member.profiles?.full_name ?? member.profiles?.email}
                              </p>
                              {isMe && <Badge variant="secondary" className="text-xs">You</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{member.profiles?.email}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {canManage && member.role !== "owner" && !isMe ? (
                              <select value={member.role}
                                onChange={(e) => handleChangeRole(member.user_id, e.target.value)}
                                className="h-7 rounded border border-input bg-background px-2 text-xs">
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            ) : (
                              <div className={`flex items-center gap-1 text-xs ${roleCfg.color}`}>
                                {roleCfg.icon} {roleCfg.label}
                              </div>
                            )}
                            {canManage && member.role !== "owner" && !isMe && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                                onClick={() => handleRemoveMember(member.user_id)}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create org modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Create Organization</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization Name *</Label>
                  <Input placeholder="Acme Corp" value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Slug * <span className="text-muted-foreground text-xs">(URL-friendly, unique)</span></Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">pipelinehealer.io/</span>
                    <Input placeholder="acme-corp" value={createForm.slug}
                      pattern="^[a-z0-9-]{2,40}$" title="Lowercase letters, numbers, hyphens (2-40 chars)"
                      onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase() })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Optional — describe your org" value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting} className="gap-2">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && selectedOrg && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Invite Member to {selectedOrg.name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowInvite(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input type="email" placeholder="colleague@company.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required />
                  <p className="text-xs text-muted-foreground">User must already have a PipelineHealer account.</p>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="admin">Admin — Can manage members and settings</option>
                    <option value="member">Member — Can view and trigger pipelines</option>
                    <option value="viewer">Viewer — Read-only access</option>
                  </select>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting} className="gap-2">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <UserPlus className="w-4 h-4" /> Add Member
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
