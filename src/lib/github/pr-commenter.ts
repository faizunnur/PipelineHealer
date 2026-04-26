interface PRCommentOptions {
  token: string;
  repoFullName: string;
  prNumber: number;
  reason: string;
  solution: string;
  filePath: string | null;
  originalCode: string | null;
  fixedCode: string | null;
  healingEventId: string;
  appUrl: string;
}

export async function postPRComment(opts: PRCommentOptions): Promise<void> {
  const [owner, repo] = opts.repoFullName.split("/");

  const diffSection = opts.originalCode && opts.fixedCode
    ? `
## 📝 Proposed Fix

**File:** \`${opts.filePath}\`

<details>
<summary>View code diff</summary>

**Before:**
\`\`\`yaml
${opts.originalCode}
\`\`\`

**After:**
\`\`\`yaml
${opts.fixedCode}
\`\`\`

</details>
`
    : "";

  const body = `## 🔧 PipelineHealer — AI Fix Ready

Your pipeline failed. Claude AI has analyzed the error and generated a fix.

### ❌ Root Cause
${opts.reason}

### 💡 Solution
${opts.solution}
${diffSection}
---

[**✅ Approve & Apply Fix**](${opts.appUrl}/healing/${opts.healingEventId}) · [**❌ Reject Fix**](${opts.appUrl}/healing/${opts.healingEventId})

*Powered by [PipelineHealer](${opts.appUrl}) + Claude AI*`;

  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${opts.prNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    }
  );
}

export async function findPRForCommit(
  token: string,
  repoFullName: string,
  commitSha: string
): Promise<number | null> {
  const [owner, repo] = repoFullName.split("/");

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}/pulls`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok) return null;
  const prs = await res.json();
  return prs?.[0]?.number ?? null;
}
