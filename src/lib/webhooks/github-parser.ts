export interface ParsedGitHubEvent {
  type: "workflow_run" | "workflow_job" | "other";
  runId?: string;
  runStatus?: "completed" | "in_progress" | "queued";
  runConclusion?: "success" | "failure" | "cancelled" | "skipped" | null;
  repoFullName: string;
  branch: string;
  commitSha: string;
  commitMessage?: string;
  triggeredBy?: string;
  workflowName?: string;
  jobs?: ParsedJob[];
}

export interface ParsedJob {
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  logUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseGitHubWorkflowRun(payload: any): ParsedGitHubEvent {
  const run = payload.workflow_run;

  return {
    type: "workflow_run",
    runId: String(run.id),
    runStatus: run.status,
    runConclusion: run.conclusion,
    repoFullName: payload.repository.full_name,
    branch: run.head_branch,
    commitSha: run.head_sha,
    commitMessage: run.head_commit?.message,
    triggeredBy: run.actor?.login,
    workflowName: run.name,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseGitHubWorkflowJob(payload: any): ParsedGitHubEvent {
  const job = payload.workflow_job;

  return {
    type: "workflow_job",
    runId: String(job.run_id),
    repoFullName: payload.repository.full_name,
    branch: job.head_branch,
    commitSha: job.head_sha,
    triggeredBy: payload.sender?.login,
    jobs: [
      {
        id: String(job.id),
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      },
    ],
  };
}
