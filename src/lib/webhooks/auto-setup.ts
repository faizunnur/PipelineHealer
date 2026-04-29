const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
});

export type WebhookResult =
  | { status: "created"; message: string }
  | { status: "exists"; message: string }
  | { status: "failed"; message: string }
  | { status: "skipped"; message: string };

// ── GitHub ────────────────────────────────────────────────────────────────────

export async function setupGitHubWebhook(
  token: string,
  repoFullName: string,
  webhookSecret: string,
  appUrl: string
): Promise<WebhookResult> {
  const [owner, repo] = repoFullName.split("/");
  const webhookUrl = `${appUrl}/api/webhooks/github`;

  if (appUrl.includes("localhost")) {
    return {
      status: "skipped",
      message: "Webhook not auto-created on localhost. Use ngrok or deploy to a public URL, then click 'Setup Webhook' to configure it.",
    };
  }

  try {
    // Check if webhook already exists
    const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks?per_page=100`, {
      headers: GH_HEADERS(token),
    });

    if (listRes.ok) {
      const hooks: { config: { url: string } }[] = await listRes.json();
      const exists = hooks.some((h) => h.config?.url === webhookUrl);
      if (exists) {
        return { status: "exists", message: "Webhook is already configured on this repository." };
      }
    }

    // Create the webhook
    const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: "POST",
      headers: GH_HEADERS(token),
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["workflow_job", "workflow_run"],
        config: {
          url: webhookUrl,
          content_type: "json",
          secret: webhookSecret,
          insecure_ssl: "0",
        },
      }),
    });

    if (createRes.status === 201) {
      return { status: "created", message: "Webhook created automatically on GitHub." };
    }

    if (createRes.status === 404) {
      return { status: "failed", message: "Repository not found or token lacks admin:repo_hook permission." };
    }

    const text = await createRes.text();
    return { status: "failed", message: `GitHub ${createRes.status}: ${text}` };
  } catch (err) {
    return { status: "failed", message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── GitLab ────────────────────────────────────────────────────────────────────

const GL_HEADERS = (token: string) => ({
  "PRIVATE-TOKEN": token,
  "Content-Type": "application/json",
});

export async function setupGitLabWebhook(
  token: string,
  repoFullName: string,
  webhookSecret: string,
  appUrl: string
): Promise<WebhookResult> {
  const webhookUrl = `${appUrl}/api/webhooks/gitlab`;

  if (appUrl.includes("localhost")) {
    return {
      status: "skipped",
      message: "Webhook not auto-created on localhost. Deploy to a public URL first, then click 'Setup Webhook'.",
    };
  }

  try {
    // Get project ID
    const projectRes = await fetch(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(repoFullName)}`,
      { headers: GL_HEADERS(token) }
    );
    if (!projectRes.ok) {
      return { status: "failed", message: `Could not find GitLab project: ${projectRes.status}` };
    }
    const project: { id: number } = await projectRes.json();
    const projectId = project.id;

    // Check if webhook already exists
    const listRes = await fetch(`https://gitlab.com/api/v4/projects/${projectId}/hooks?per_page=100`, {
      headers: GL_HEADERS(token),
    });
    if (listRes.ok) {
      const hooks: { url: string }[] = await listRes.json();
      if (hooks.some((h) => h.url === webhookUrl)) {
        return { status: "exists", message: "Webhook is already configured on this project." };
      }
    }

    // Create the webhook
    const createRes = await fetch(`https://gitlab.com/api/v4/projects/${projectId}/hooks`, {
      method: "POST",
      headers: GL_HEADERS(token),
      body: JSON.stringify({
        url: webhookUrl,
        token: webhookSecret,
        pipeline_events: true,
        job_events: true,
        push_events: false,
      }),
    });

    if (createRes.status === 201) {
      return { status: "created", message: "Webhook created automatically on GitLab." };
    }

    const text = await createRes.text();
    return { status: "failed", message: `GitLab ${createRes.status}: ${text}` };
  } catch (err) {
    return { status: "failed", message: err instanceof Error ? err.message : "Unknown error" };
  }
}
