import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";

// POST /api/templates/[id]/apply
// body: { pipelineId, fileName, mode: "auto" | "manual" }
// auto = commit the file to the repo; manual = just return the content
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { pipelineId, fileName, mode } = await req.json();

  const db = createAdminClient();

  const { data: template } = await db
    .from("pipeline_templates")
    .select("content, name, provider")
    .eq("id", id)
    .single();

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Increment use_count
  const { data: cur } = await db.from("pipeline_templates").select("use_count").eq("id", id).single();
  await db.from("pipeline_templates").update({ use_count: (cur?.use_count ?? 0) + 1 }).eq("id", id);

  if (mode === "manual") {
    return NextResponse.json({ content: template.content, fileName });
  }

  // Auto-commit mode — need pipeline's repo + token
  const { data: pipeline } = await db
    .from("pipelines")
    .select("repo_full_name, provider, default_branch, integration_id, integrations(encrypted_token, token_iv, token_tag)")
    .eq("id", pipelineId)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  const intg = pipeline.integrations as {
    encrypted_token: string; token_iv: string; token_tag: string;
  } | null;
  if (!intg) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

  const token = decrypt({ encrypted: intg.encrypted_token, iv: intg.token_iv, tag: intg.token_tag });

  // Determine target file path
  const filePath = pipeline.provider === "github"
    ? `.github/workflows/${fileName}`
    : fileName === ".gitlab-ci.yml" ? ".gitlab-ci.yml" : `.gitlab-ci/${fileName}`;

  const contentBase64 = Buffer.from(template.content).toString("base64");
  const branch = pipeline.default_branch;

  if (pipeline.provider === "github") {
    // Check if file exists (get its SHA for update)
    const checkRes = await fetch(
      `https://api.github.com/repos/${pipeline.repo_full_name}/contents/${filePath}?ref=${branch}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
    );

    let sha: string | undefined;
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }

    const res = await fetch(
      `https://api.github.com/repos/${pipeline.repo_full_name}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Add pipeline template: ${template.name}`,
          content: contentBase64,
          branch,
          ...(sha ? { sha } : {}),
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.message ?? "GitHub commit failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, filePath, branch });
  }

  // GitLab
  const projectId = encodeURIComponent(pipeline.repo_full_name);
  const encodedPath = encodeURIComponent(filePath);

  // Check if file exists
  const checkRes = await fetch(
    `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodedPath}?ref=${branch}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const method = checkRes.ok ? "PUT" : "POST";

  const res = await fetch(
    `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodedPath}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branch,
        content: template.content,
        commit_message: `Add pipeline template: ${template.name}`,
        encoding: "text",
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err.message ?? "GitLab commit failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, filePath, branch });
}
