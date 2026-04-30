"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Github, Gitlab } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TriggerButton } from "@/components/pipelines/TriggerButton";
import { DeletePipelineButton } from "@/components/pipelines/DeletePipelineButton";
import { WebhookSetupButton } from "@/components/pipelines/WebhookSetupButton";
import { LivePipelineRuns } from "@/components/pipelines/LivePipelineRuns";

type Run = {
  id: string; status: string; branch: string; commit_sha: string;
  commit_message: string | null; triggered_by: string | null;
  started_at: string | null; completed_at: string | null;
  duration_seconds: number | null; created_at: string;
  pipeline_jobs: Array<{
    id: string; job_name: string; status: string;
    duration_seconds: number | null; error_excerpt: string | null;
  }> | null;
};

interface Props {
  pipeline: {
    id: string;
    repo_full_name: string;
    provider: string;
    default_branch: string;
    last_status: string | null;
    webhook_status: "created" | "exists" | "failed" | "skipped" | null;
  };
  initialRuns: Run[];
}

const STATUS_MAP: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
  success:   { label: "Success",     variant: "success" },
  failure:   { label: "Failed",      variant: "destructive" },
  failed:    { label: "Failed",      variant: "destructive" },
  in_progress: { label: "Running",   variant: "warning" },
  running:   { label: "Running",     variant: "warning" },
  queued:    { label: "Queued",      variant: "secondary" },
  cancelled: { label: "Cancelled",   variant: "secondary" },
  unknown:   { label: "Unknown",     variant: "secondary" },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { label: status, variant: "secondary" as const };
  const isRunning = status === "running" || status === "in_progress";
  return (
    <span className="relative inline-flex items-center">
      {isRunning && (
        <span className="absolute -inset-1 rounded-full animate-ping bg-warning/30" />
      )}
      <Badge variant={info.variant} className="text-xs flex-shrink-0 relative">
        {info.label}
      </Badge>
    </span>
  );
}

export function PipelineDetailClient({ pipeline, initialRuns }: Props) {
  const [liveStatus, setLiveStatus] = useState(pipeline.last_status ?? "unknown");

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pipelines">
            <ArrowLeft className="w-4 h-4" />
            Pipelines
          </Link>
        </Button>
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {pipeline.provider === "github" ? (
            <Github className="w-5 h-5" />
          ) : (
            <Gitlab className="w-5 h-5 text-orange-500" />
          )}
          <h1 className="text-xl font-bold">{pipeline.repo_full_name}</h1>
          <StatusBadge status={liveStatus} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pipeline.provider === "github" && (
            <TriggerButton
              pipelineId={pipeline.id}
              defaultBranch={pipeline.default_branch}
            />
          )}
          <WebhookSetupButton
            pipelineId={pipeline.id}
            initialStatus={pipeline.webhook_status}
          />
          <DeletePipelineButton
            pipelineId={pipeline.id}
            repoName={pipeline.repo_full_name}
            variant="full"
            redirectAfter="/pipelines"
          />
        </div>
      </div>

      {/* Live runs */}
      <LivePipelineRuns
        pipelineId={pipeline.id}
        initialRuns={initialRuns}
        initialStatus={liveStatus}
        provider={pipeline.provider}
        onStatusChange={setLiveStatus}
      />
    </div>
  );
}
