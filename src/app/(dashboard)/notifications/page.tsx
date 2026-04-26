"use client";

import { useState, useEffect } from "react";
import {
  Bell, Plus, Slack, Trash2, TestTube2, CheckCircle2,
  Loader2, Mail, MessageSquare, Globe, ToggleLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

type Channel = {
  id: string; name: string; type: string;
  email_address: string | null; events: string[];
  is_active: boolean; created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  failure: "Pipeline Failure",
  healing_complete: "Fix Ready for Review",
  healing_applied: "Fix Applied",
  sla_violation: "SLA Violation",
  security_alert: "Security Alert",
  weekly_report: "Weekly Report",
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  slack: <Slack className="w-5 h-5 text-[#4A154B]" />,
  teams: <MessageSquare className="w-5 h-5 text-[#6264A7]" />,
  discord: <Globe className="w-5 h-5 text-[#5865F2]" />,
  email: <Mail className="w-5 h-5 text-primary" />,
};

const ALL_EVENTS = Object.keys(EVENT_LABELS);

export default function NotificationsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  // Form state
  const [formType, setFormType] = useState<"slack"|"teams"|"discord"|"email">("slack");
  const [formName, setFormName] = useState("");
  const [formWebhook, setFormWebhook] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>(["failure","healing_complete","healing_applied"]);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => { loadChannels(); }, []);

  async function loadChannels() {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setChannels(data.channels ?? []);
    setLoading(false);
  }

  async function addChannel(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const body: Record<string, unknown> = { name: formName, type: formType, events: formEvents };
    if (formType !== "email") body.webhookUrl = formWebhook;
    else body.emailAddress = formEmail;

    const res = await fetch("/api/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Notification channel added!" });
      setAddOpen(false);
      loadChannels();
      setFormName(""); setFormWebhook(""); setFormEmail("");
    } else {
      const d = await res.json();
      toast({ title: "Failed", description: d.error, variant: "destructive" });
    }
  }

  async function deleteChannel(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setChannels((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Channel removed" });
  }

  async function toggleChannel(id: string, is_active: boolean) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    setChannels((prev) => prev.map((c) => c.id === id ? { ...c, is_active } : c));
  }

  async function testChannel(id: string) {
    setTestingId(id);
    const res = await fetch(`/api/notifications/${id}/test`, { method: "POST" });
    setTestingId(null);
    if (res.ok) toast({ title: "Test sent!", description: "Check your channel for the test message." });
    else toast({ title: "Test failed", description: "Could not send test notification.", variant: "destructive" });
  }

  function toggleEvent(ev: string) {
    setFormEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Notifications
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Get alerts on Slack, Teams, Discord, or email when pipelines fail
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4" /> Add Channel</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Notification Channel</DialogTitle>
            </DialogHeader>
            <form onSubmit={addChannel} className="space-y-4 mt-2">
              {/* Provider */}
              <div className="space-y-2">
                <Label>Provider</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(["slack","teams","discord","email"] as const).map((p) => (
                    <button key={p} type="button"
                      onClick={() => setFormType(p)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-xs capitalize transition-all ${
                        formType === p ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      {PROVIDER_ICONS[p]}
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Channel Name</Label>
                <Input placeholder="e.g. #alerts, Team Notifications"
                  value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </div>

              {formType !== "email" ? (
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input placeholder={`https://hooks.${formType}.com/...`}
                    value={formWebhook} onChange={(e) => setFormWebhook(e.target.value)} required type="url" />
                  <p className="text-xs text-muted-foreground">
                    {formType === "slack" && "Slack: Apps → Incoming Webhooks → Add to Slack"}
                    {formType === "teams" && "Teams: Channel → Connectors → Incoming Webhook"}
                    {formType === "discord" && "Discord: Channel Settings → Integrations → Webhooks"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input type="email" placeholder="alerts@yourcompany.com"
                    value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">Requires RESEND_API_KEY in environment</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notify on</Label>
                <div className="space-y-2">
                  {ALL_EVENTS.map((ev) => (
                    <label key={ev} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formEvents.includes(ev)}
                        onChange={() => toggleEvent(ev)}
                        className="rounded border-border" />
                      <span className="text-sm">{EVENT_LABELS[ev]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={saving || formEvents.length === 0}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Channel
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {!loading && channels.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium mb-1">No notification channels yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Get Slack, Teams, or Discord alerts when pipelines fail and fixes are ready
            </p>
            <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Add Channel</Button>
          </CardContent>
        </Card>
      )}

      {/* Channels list */}
      <div className="space-y-3">
        {channels.map((ch) => (
          <Card key={ch.id} className={!ch.is_active ? "opacity-60" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {PROVIDER_ICONS[ch.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ch.name}</span>
                    <Badge variant="secondary" className="text-xs capitalize">{ch.type}</Badge>
                    {!ch.is_active && <Badge variant="secondary" className="text-xs">Paused</Badge>}
                  </div>
                  {ch.email_address && (
                    <p className="text-xs text-muted-foreground">{ch.email_address}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ch.events.map((ev) => (
                      <span key={ev} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {EVENT_LABELS[ev] ?? ev}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Switch checked={ch.is_active} onCheckedChange={(v) => toggleChannel(ch.id, v)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => testChannel(ch.id)} disabled={testingId === ch.id} title="Send test">
                    {testingId === ch.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <TestTube2 className="w-3.5 h-3.5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive"
                    onClick={() => deleteChannel(ch.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Notifications are sent for all your pipelines</p>
            <p className="text-muted-foreground text-xs">
              When a pipeline fails, Claude generates a fix, and you receive an alert with a direct approve/reject link.
              Auto-approve users get notified after the fix is applied.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
