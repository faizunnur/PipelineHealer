import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";
import { ghGetTree } from "@/lib/repo-browser/github";
import { glGetTree, glGetProjectId } from "@/lib/repo-browser/gitlab";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const integrationId = searchParams.get("integrationId");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path") ?? "";
  const ref = searchParams.get("ref") ?? "main";

  if (!integrationId || !repo) {
    return NextResponse.json({ error: "integrationId and repo required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: intg } = await db
    .from("integrations")
    .select("provider, encrypted_token, token_iv, token_tag")
    .eq("id", integrationId)
    .eq("user_id", session.userId)
    .single();

  if (!intg) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

  const token = decrypt({ encrypted: intg.encrypted_token, iv: intg.token_iv, tag: intg.token_tag });

  try {
    let items;
    if (intg.provider === "github") {
      const [owner, repoName] = repo.split("/");
      items = await ghGetTree(token, owner, repoName, path, ref);
    } else {
      const projectId = await glGetProjectId(token, repo);
      items = await glGetTree(token, projectId, path, ref);
    }

    // Sort: dirs first, then files, alphabetically within each group
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
