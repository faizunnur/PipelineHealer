import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";
import { ghListRepos } from "@/lib/repo-browser/github";
import { glListProjects } from "@/lib/repo-browser/gitlab";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integrationId = req.nextUrl.searchParams.get("integrationId");
  if (!integrationId) return NextResponse.json({ error: "integrationId required" }, { status: 400 });

  const db = createAdminClient();
  const { data: intg } = await db
    .from("integrations")
    .select("id, provider, encrypted_token, token_iv, token_tag")
    .eq("id", integrationId)
    .eq("user_id", session.userId)
    .single();

  if (!intg) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

  const token = decrypt({ encrypted: intg.encrypted_token, iv: intg.token_iv, tag: intg.token_tag });

  try {
    if (intg.provider === "github") {
      const repos = await ghListRepos(token);
      return NextResponse.json({
        repos: repos.map((r) => ({
          full_name: r.full_name,
          name: r.name,
          private: r.private,
          default_branch: r.default_branch,
          language: r.language,
          pushed_at: r.pushed_at,
          description: r.description,
        })),
      });
    } else {
      const projects = await glListProjects(token);
      return NextResponse.json({
        repos: projects.map((p) => ({
          full_name: p.path_with_namespace,
          name: p.name,
          private: p.visibility === "private",
          default_branch: p.default_branch,
          language: null,
          pushed_at: p.last_activity_at,
          description: p.description,
        })),
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
