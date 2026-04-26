import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";

export interface RollbackResult {
  success: boolean;
  sha?: string;
  error?: string;
}

/**
 * Fetch recent commits for a GitHub repo to allow rollback selection.
 */
export async function fetchRecentCommits(
  token: string,
  repoFullName: string,
  branch: string,
  perPage = 10
): Promise<Array<{ sha: string; message: string; date: string; author: string }>> {
  const [owner, repo] = repoFullName.split("/");
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${perPage}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return data.map((c: { sha: string; commit: { message: string; author: { date: string; name: string } } }) => ({
    sha: c.sha,
    message: c.commit.message.split("\n")[0],
    date: c.commit.author.date,
    author: c.commit.author.name,
  }));
}

/**
 * Revert to a specific commit SHA by force-pushing a revert commit via GitHub API.
 * Strategy: create a new commit that applies the tree of the target SHA.
 */
export async function rollbackGitHub(
  token: string,
  repoFullName: string,
  branch: string,
  targetSha: string
): Promise<RollbackResult> {
  const [owner, repo] = repoFullName.split("/");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  try {
    // Get the tree of the target commit
    const targetRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${targetSha}`,
      { headers }
    );
    if (!targetRes.ok) throw new Error(`Failed to fetch target commit: ${targetRes.status}`);
    const targetCommit = await targetRes.json();

    // Get current HEAD SHA for the branch
    const branchRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`,
      { headers }
    );
    if (!branchRes.ok) throw new Error(`Failed to fetch branch: ${branchRes.status}`);
    const branchData = await branchRes.json();
    const currentSha = branchData.commit.sha;

    // Create a new commit using the target tree
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: `chore: rollback to ${targetSha.slice(0, 7)} via PipelineHealer`,
          tree: targetCommit.commit.tree.sha,
          parents: [currentSha],
        }),
      }
    );
    if (!newCommitRes.ok) {
      const err = await newCommitRes.json();
      throw new Error(err.message ?? "Failed to create rollback commit");
    }
    const newCommit = await newCommitRes.json();

    // Update the branch ref
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ sha: newCommit.sha }),
      }
    );
    if (!refRes.ok) {
      const err = await refRes.json();
      throw new Error(err.message ?? "Failed to update branch ref");
    }

    return { success: true, sha: newCommit.sha };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Orchestrate a rollback: find the pipeline's integration, decrypt token, call rollbackGitHub.
 */
export async function orchestrateRollback(
  userId: string,
  pipelineId: string,
  runId: string,
  targetSha: string,
  reason: string
): Promise<RollbackResult> {
  const supabase = createAdminClient();

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("repo_full_name, provider, integrations(encrypted_token, token_iv, token_tag)")
    .eq("id", pipelineId)
    .eq("user_id", userId)
    .single();

  if (!pipeline) return { success: false, error: "Pipeline not found" };

  const pipelineData = pipeline as {
    repo_full_name: string;
    provider: string;
    integrations: { encrypted_token: string; token_iv: string; token_tag: string };
  };

  if (pipelineData.provider !== "github") {
    return { success: false, error: "Rollback currently supported for GitHub only" };
  }

  const { data: run } = await supabase
    .from("pipeline_runs")
    .select("branch")
    .eq("id", runId)
    .single();

  const branch = run?.branch ?? "main";
  const plainToken = decrypt({
    encrypted: pipelineData.integrations.encrypted_token,
    iv: pipelineData.integrations.token_iv,
    tag: pipelineData.integrations.token_tag,
  });

  // Insert rollback_event record (pending)
  const { data: rollbackEvent } = await supabase
    .from("rollback_events")
    .insert({
      user_id: userId,
      pipeline_id: pipelineId,
      run_id: runId,
      trigger_run_id: runId,
      target_sha: targetSha,
      target_commit_sha: targetSha,
      reason,
      status: "pending",
      rollback_method: "revert_commit",
    })
    .select()
    .single();

  const result = await rollbackGitHub(plainToken, pipelineData.repo_full_name, branch, targetSha);

  await supabase
    .from("rollback_events")
    .update({
      status: result.success ? "applied" : "failed",
      result_sha: result.sha ?? null,
      error: result.error ?? null,
      executed_at: new Date().toISOString(),
    })
    .eq("id", rollbackEvent?.id ?? "");

  return result;
}
