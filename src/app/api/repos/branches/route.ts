import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";
import { ghListBranches } from "@/lib/repo-browser/github";
import { glListBranches, glGetProjectId } from "@/lib/repo-browser/gitlab";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const integrationId = searchParams.get("integrationId");
  const repo = searchParams.get("repo"); // owner/repo

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
    if (intg.provider === "github") {
      const [owner, repoName] = repo.split("/");
      const branches = await ghListBranches(token, owner, repoName);
      return NextResponse.json({ branches });
    } else {
      const projectId = await glGetProjectId(token, repo);
      const branches = await glListBranches(token, projectId);
      return NextResponse.json({ branches });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
