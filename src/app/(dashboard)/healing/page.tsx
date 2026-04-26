import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Wrench, CheckCircle2, XCircle, Clock, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HealingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: events } = await supabase
    .from("healing_events")
    .select(
      `id, status, ai_reason, ai_tokens_used, approval_mode, created_at,
       pipelines(repo_full_name, provider),
       pipeline_jobs(job_name)`
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const pending = events?.filter((e) => e.status === "pending_review") ?? [];
  const others = events?.filter((e) => e.status !== "pending_review") ?? [];

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Healing Events</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI-generated fixes for your failed pipeline jobs
        </p>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-warning uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Awaiting Review ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((event) => (
              <HealingCard key={event.id} event={event} highlight />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          History
        </h2>
        {others.length === 0 && pending.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No healing events yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                When a pipeline fails, Claude AI will automatically analyze it.
              </p>
            </CardContent>
          </Card>
        )}
        <div className="space-y-2">
          {others.map((event) => (
            <HealingCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HealingCard({
  event,
  highlight,
}: {
  event: {
    id: string;
    status: string;
    ai_reason: string | null;
    ai_tokens_used: number;
    approval_mode: string;
    created_at: string;
    pipelines: { repo_full_name: string; provider: string } | null;
    pipeline_jobs: { job_name: string } | null;
  };
  highlight?: boolean;
}) {
  const pipeline = event.pipelines;
  const job = event.pipeline_jobs;

  return (
    <Link href={`/healing/${event.id}`}>
      <Card
        className={`hover:border-primary/50 transition-colors cursor-pointer ${
          highlight ? "border-warning/40 bg-warning/5" : ""
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <StatusIcon status={event.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">
                  {pipeline?.repo_full_name ?? "Unknown repo"}
                </span>
                <Badge
                  variant={
                    pipeline?.provider === "github" ? "secondary" : "outline"
                  }
                  className="text-xs"
                >
                  {pipeline?.provider ?? "unknown"}
                </Badge>
              </div>
              {job && (
                <p className="text-xs text-muted-foreground">
                  Job: {job.job_name}
                </p>
              )}
              {event.ai_reason && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {event.ai_reason}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 text-right space-y-1">
              <StatusBadge status={event.status} />
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(event.created_at)}
              </p>
              {event.ai_tokens_used > 0 && (
                <p className="text-xs text-muted-foreground">
                  {event.ai_tokens_used} tokens
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "applied")
    return <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />;
  if (status === "rejected")
    return <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />;
  if (status === "pending_review")
    return <Clock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />;
  return <Wrench className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
    applied: { label: "Fixed", variant: "success" },
    rejected: { label: "Rejected", variant: "destructive" },
    pending_review: { label: "Pending", variant: "warning" },
    applying: { label: "Applying", variant: "warning" },
    apply_failed: { label: "Failed", variant: "destructive" },
  };
  const info = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant} className="text-xs">{info.label}</Badge>;
}
