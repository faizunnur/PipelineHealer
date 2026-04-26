interface ApplyFixOptions {
  token: string;
  repoFullName: string;
  filePath: string;
  originalCode: string;
  fixedCode: string;
  reason: string;
}

export async function applyGitHubFix(opts: ApplyFixOptions): Promise<void> {
  const headers = {
    Authorization: `Bearer ${opts.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  const [owner, repo] = opts.repoFullName.split("/");

  // Fetch current file
  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${opts.filePath}`,
    { headers }
  );

  if (!getRes.ok) {
    throw new Error(`GitHub API: Failed to fetch file ${opts.filePath}: ${getRes.status} ${await getRes.text()}`);
  }

  const fileData = await getRes.json();
  const currentContent = Buffer.from(fileData.content, "base64").toString("utf8");

  if (!currentContent.includes(opts.originalCode)) {
    throw new Error(
      `Cannot apply fix: original code not found in ${opts.filePath}. The file may have changed.`
    );
  }

  const updatedContent = currentContent.replace(opts.originalCode, opts.fixedCode);

  // Commit the change
  const commitRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${opts.filePath}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `fix(ci): auto-heal - ${opts.reason.slice(0, 72)}`,
        content: Buffer.from(updatedContent).toString("base64"),
        sha: fileData.sha,
      }),
    }
  );

  if (!commitRes.ok) {
    throw new Error(`GitHub API: Failed to commit fix: ${commitRes.status} ${await commitRes.text()}`);
  }
}

export async function fetchWorkflowContent(
  token: string,
  repoFullName: string,
  filePath: string
): Promise<string | null> {
  const [owner, repo] = repoFullName.split("/");

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf8");
}

export async function fetchJobLog(
  token: string,
  repoFullName: string,
  jobId: string
): Promise<string | null> {
  const [owner, repo] = repoFullName.split("/");

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      redirect: "follow",
    }
  );

  if (!res.ok) return null;
  return await res.text();
}
