export interface ParsedGitLabEvent {
  pipelineId?: string;
  jobId?: string;
  status?: string;
  repoFullName: string;
  branch: string;
  commitSha: string;
  commitMessage?: string;
  triggeredBy?: string;
  pipelineName?: string;
  jobName?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseGitLabPipelineEvent(payload: any): ParsedGitLabEvent {
  return {
    pipelineId: String(payload.object_attributes?.id),
    status: payload.object_attributes?.status,
    repoFullName: payload.project?.path_with_namespace,
    branch: payload.object_attributes?.ref,
    commitSha: payload.object_attributes?.sha,
    commitMessage: payload.commit?.message,
    triggeredBy: payload.user?.username,
    pipelineName: payload.project?.name,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseGitLabJobEvent(payload: any): ParsedGitLabEvent {
  return {
    jobId: String(payload.build_id),
    pipelineId: String(payload.pipeline_id),
    status: payload.build_status,
    repoFullName: payload.project_name?.replace(/ /g, "-").toLowerCase() ?? "",
    branch: payload.ref,
    commitSha: payload.sha,
    triggeredBy: payload.user?.name,
    jobName: payload.build_name,
  };
}
