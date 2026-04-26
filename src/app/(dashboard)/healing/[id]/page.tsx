"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  FileCode,
  Lightbulb,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";

type HealingEvent = {
  id: string;
  status: string;
  error_excerpt: string;
  ai_reason: string | null;
  ai_solution: string | null;
  ai_file_path: string | null;
  ai_original_code: string | null;
  ai_fixed_code: string | null;
  ai_tokens_used: number;
  ai_model: string;
  approval_mode: string;
  created_at: string;
  apply_error: string | null;
  pipelines: { repo_full_name: string; provider: string } | null;
  pipeline_jobs: { job_name: string } | null;
};

export default function HealingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<HealingEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    loadEvent();
    // Subscribe to realtime updates
    const supabase = createClient();
    const channel = supabase
      .channel(`healing-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "healing_events",
          filter: `id=eq.${id}`,
        },
        () => loadEvent()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadEvent() {
    const supabase = createClient();
    const { data } = await supabase
      .from("healing_events")
      .select(
        `*, pipelines(repo_full_name, provider), pipeline_jobs(job_name)`
      )
      .eq("id", id)
      .single();
    setEvent(data as HealingEvent | null);
    setLoading(false);
  }

  async function handleApprove() {
    setApproving(true);
    const res = await fetch(`/api/healing/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    setApproving(false);

    if (res.ok) {
      toast({ title: "Fix applied!", description: "The pipeline fix has been committed.", variant: "default" });
      loadEvent();
    } else {
      const data = await res.json();
      toast({ title: "Failed to apply fix", description: data.error, variant: "destructive" });
    }
  }

  async function handleReject() {
    setRejecting(true);
    const res = await fetch(`/api/healing/${id}/reject`, { method: "POST" });
    setRejecting(false);

    if (res.ok) {
      toast({ title: "Fix rejected", description: "The healing event has been rejected." });
      router.push("/healing");
    } else {
      toast({ title: "Error", description: "Failed to reject the event.", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6">
        <p>Healing event not found.</p>
        <Button asChild className="mt-4"><Link href="/healing">Back</Link></Button>
      </div>
    );
  }

  const isPending = event.status === "pending_review";
  const isApplied = event.status === "applied";
  const isFailed = event.status === "apply_failed";

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/healing">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">Healing Event</h1>
            <StatusBadge status={event.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {event.pipelines?.repo_full_name ?? "Unknown repo"} ·{" "}
            {event.pipeline_jobs?.job_name ?? "Unknown job"} ·{" "}
            {formatRelativeTime(event.created_at)}
          </p>
        </div>
      </div>

      {/* Error Section */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Error Output
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="code-block text-xs overflow-x-auto whitespace-pre-wrap text-red-400 bg-red-950/20 border border-red-900/30 max-h-64">
            {event.error_excerpt}
          </pre>
        </CardContent>
      </Card>

      {/* AI Analysis */}
      {event.ai_reason && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              AI Analysis
              <span className="text-xs font-normal text-muted-foreground ml-auto">
                {event.ai_tokens_used} tokens · {event.ai_model}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                Root Cause
              </p>
              <p className="text-sm">{event.ai_reason}</p>
            </div>
            {event.ai_solution && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" />
                  Solution
                </p>
                <p className="text-sm">{event.ai_solution}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diff Viewer */}
      {event.ai_file_path && event.ai_original_code && event.ai_fixed_code && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCode className="w-4 h-4 text-primary" />
              Proposed Change
              <code className="text-xs bg-muted px-2 py-0.5 rounded ml-auto font-mono">
                {event.ai_file_path}
              </code>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-destructive" />
                  Before (remove)
                </p>
                <pre className="code-block text-xs bg-destructive/10 border border-destructive/20 text-red-400 whitespace-pre-wrap max-h-64 overflow-auto">
                  {event.ai_original_code}
                </pre>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                  After (add)
                </p>
                <pre className="code-block text-xs bg-success/10 border border-success/20 text-green-400 whitespace-pre-wrap max-h-64 overflow-auto">
                  {event.ai_fixed_code}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apply Error */}
      {isFailed && event.apply_error && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <p className="text-sm text-destructive font-medium mb-1">
              Failed to apply fix
            </p>
            <p className="text-xs text-muted-foreground">{event.apply_error}</p>
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {isApplied && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-medium text-success">Fix applied successfully!</p>
              <p className="text-xs text-muted-foreground">
                The fix has been committed to your repository. A new pipeline run should start shortly.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval Buttons */}
      {(isPending || isFailed) && event.ai_fixed_code && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <div className="flex-1">
            <p className="text-sm font-medium">Ready to apply this fix?</p>
            <p className="text-xs text-muted-foreground">
              The fix will be committed directly to your repository.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              disabled={rejecting || approving}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              {rejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Reject
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={approving || rejecting}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              {approving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Apply Fix
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
    applied: { label: "Fixed", variant: "success" },
    rejected: { label: "Rejected", variant: "destructive" },
    pending_review: { label: "Pending Review", variant: "warning" },
    applying: { label: "Applying...", variant: "warning" },
    apply_failed: { label: "Apply Failed", variant: "destructive" },
  };
  const info = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}
