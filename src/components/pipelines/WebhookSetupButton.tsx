"use client";

import { useState } from "react";
import { Webhook, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface WebhookSetupButtonProps {
  pipelineId: string;
  initialStatus?: "created" | "exists" | "failed" | "skipped" | null;
}

export function WebhookSetupButton({ pipelineId, initialStatus }: WebhookSetupButtonProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(initialStatus ?? null);
  const [message, setMessage] = useState("");

  async function handleSetup() {
    setLoading(true);
    const res = await fetch(`/api/pipelines/${pipelineId}`, { method: "POST" });
    const data = await res.json();
    setLoading(false);

    const result = data.result as { status: string; message: string } | undefined;
    if (result) {
      setStatus(result.status as "created" | "exists" | "failed" | "skipped");
      setMessage(result.message);
      if (result.status === "created") {
        toast({ title: "Webhook created!", description: result.message });
      } else if (result.status === "exists") {
        toast({ title: "Webhook already configured", description: result.message });
      } else {
        toast({ title: "Webhook setup failed", description: result.message, variant: "destructive" });
      }
    }
  }

  const statusConfig = {
    created: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Webhook active" },
    exists:  { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Webhook active" },
    failed:  { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", label: "Webhook failed" },
    skipped: { icon: Info, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Manual setup needed" },
  };

  const cfg = status ? statusConfig[status] : null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {cfg ? (
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
          <cfg.icon className="w-3.5 h-3.5" />
          <span>{cfg.label}</span>
        </div>
      ) : null}

      {(status === "failed" || status === "skipped" || !status) && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-7 text-xs"
          disabled={loading}
          onClick={handleSetup}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Webhook className="w-3 h-3" />}
          {loading ? "Setting up…" : "Setup Webhook"}
        </Button>
      )}

      {message && (status === "failed" || status === "skipped") && (
        <p className="w-full text-xs text-muted-foreground mt-1">{message}</p>
      )}
    </div>
  );
}
