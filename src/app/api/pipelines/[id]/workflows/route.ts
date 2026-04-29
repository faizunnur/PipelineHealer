import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
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

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows?per_page=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `GitHub ${res.status}: ${text}` }, { status: 502 });
  }

  const data = await res.json() as {
    workflows: { id: number; name: string; path: string; state: string }[];
  };

  const workflows = (data.workflows ?? [])
    .filter((w) => w.state === "active")
    .map((w) => ({
      id: w.id,
      name: w.name,
      file: w.path.split("/").pop() ?? w.path, // e.g. "ci.yml"
      path: w.path,
    }));

  return NextResponse.json({ workflows });
}
