interface ApplyFixOptions {
  token: string;
  repoFullName: string;
  filePath: string;
  originalCode: string;
  fixedCode: string;
  reason: string;
}

const GITLAB_API = "https://gitlab.com/api/v4";

function encodeProjectId(repoFullName: string): string {
  return encodeURIComponent(repoFullName);
}

export async function applyGitLabFix(opts: ApplyFixOptions): Promise<void> {
  const projectId = encodeProjectId(opts.repoFullName);
  const headers = {
    "PRIVATE-TOKEN": opts.token,
    "Content-Type": "application/json",
  };

  // Fetch current file
  const getRes = await fetch(
    `${GITLAB_API}/projects/${projectId}/repository/files/${encodeURIComponent(opts.filePath)}?ref=HEAD`,
    { headers }
  );

  if (!getRes.ok) {
    throw new Error(`GitLab API: Failed to fetch file: ${getRes.status}`);
  }

  const fileData = await getRes.json();
  const currentContent = Buffer.from(fileData.content, "base64").toString("utf8");

  if (!currentContent.includes(opts.originalCode)) {
    throw new Error(
      `Cannot apply fix: original code not found in ${opts.filePath}.`
    );
  }

  const updatedContent = currentContent.replace(opts.originalCode, opts.fixedCode);

  // Commit the change
  const commitRes = await fetch(
    `${GITLAB_API}/projects/${projectId}/repository/files/${encodeURIComponent(opts.filePath)}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        branch: fileData.ref || "main",
        content: updatedContent,
        commit_message: `fix(ci): auto-heal - ${opts.reason.slice(0, 72)}`,
      }),
    }
  );

  if (!commitRes.ok) {
    throw new Error(`GitLab API: Failed to commit fix: ${commitRes.status}`);
  }
}

export async function fetchGitLabJobLog(
  token: string,
  repoFullName: string,
  jobId: string
): Promise<string | null> {
  const projectId = encodeProjectId(repoFullName);

  const res = await fetch(
    `${GITLAB_API}/projects/${projectId}/jobs/${jobId}/trace`,
    {
      headers: { "PRIVATE-TOKEN": token },
    }
  );

  if (!res.ok) return null;
  return await res.text();
}
