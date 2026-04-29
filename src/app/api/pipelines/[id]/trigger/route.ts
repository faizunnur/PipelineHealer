import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { workflowId, branch } = await req.json() as { workflowId: number | string; branch: string };

  if (!workflowId || !branch) {
    return NextResponse.json({ error: "workflowId and branch are required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: pipeline } = await db
    .from("pipelines")
    .select("repo_full_name, provider, integrations(encrypted_token, token_iv, token_tag)")
    .eq("id", id)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  if (pipeline.provider !== "github") {
    return NextResponse.json({ error: "Workflow dispatch is only supported for GitHub" }, { status: 400 });
  }

  const intg = pipeline.integrations as { encrypted_token: string; token_iv: string; token_tag: string } | null;
  if (!intg) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

  const token = decrypt({ encrypted: intg.encrypted_token, iv: intg.token_iv, tag: intg.token_tag });
  const [owner, repo] = pipeline.repo_full_name.split("/");

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: branch }),
    }
  );

  // 204 = success (no body), 422 = workflow has no workflow_dispatch trigger
  if (res.status === 204) return NextResponse.json({ ok: true });

  if (res.status === 422) {
    return NextResponse.json(
      { error: "This workflow does not have a workflow_dispatch trigger. Add `on: workflow_dispatch` to the workflow YAML to enable manual runs." },
      { status: 422 }
    );
  }

  const text = await res.text();
  return NextResponse.json({ error: `GitHub ${res.status}: ${text}` }, { status: 502 });
}
