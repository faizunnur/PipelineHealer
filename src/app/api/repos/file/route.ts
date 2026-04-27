import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";
import { ghGetFile, ghCommitFile, ghCreateFile, ghDeleteFile } from "@/lib/repo-browser/github";
import { glGetFile, glCommitFile, glCreateFile, glDeleteFile, glGetProjectId } from "@/lib/repo-browser/gitlab";

async function getIntegration(integrationId: string, userId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("integrations")
    .select("provider, encrypted_token, token_iv, token_tag")
    .eq("id", integrationId)
    .eq("user_id", userId)
    .single();
  return data;
}

// GET /api/repos/file?integrationId=&repo=owner/repo&path=file.ts&ref=main
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const integrationId = searchParams.get("integrationId");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path");
  const ref = searchParams.get("ref") ?? "main";

  if (!integrationId || !repo || !path) {
    return NextResponse.json({ error: "integrationId, repo and path required" }, { status: 400 });
  }

  const intg = await getIntegration(integrationId, session.userId);
  if (!intg) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

  const token = decrypt({ encrypted: intg.encrypted_token, iv: intg.token_iv, tag: intg.token_tag });

  try {
    if (intg.provider === "github") {
      const [owner, repoName] = repo.split("/");
      const file = await ghGetFile(token, owner, repoName, path, ref);
      return NextResponse.json(file);
    } else {
      const projectId = await glGetProjectId(token, repo);
      const file = await glGetFile(token, projectId, path, ref);
      return NextResponse.json(file);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// PUT /api/repos/file — update existing file
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { integrationId, repo, path, content, sha, message, branch } = await req.json() as {
    integrationId: string; repo: string; path: string; content: string;
    sha: string; message: string; branch: string;
  };

  if (!integrationId || !repo || !path || content === undefined || !sha || !message || !branch) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const intg = await getIntegration(integrationId, session.userId);
  if (!intg) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

  const token = decrypt({ encrypted: intg.encrypted_token, iv: intg.token_iv, tag: intg.token_tag });

  try {
    if (intg.provider === "github") {
      const [owner, repoName] = repo.split("/");
      await ghCommitFile(token, owner, repoName, path, content, sha, message, branch);
    } else {
      const projectId = await glGetProjectId(token, repo);
      await glCommitFile(token, projectId, path, content, message, branch);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// POST /api/repos/file — create new file
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { integrationId, repo, path, content, message, branch } = await req.json() as {
    integrationId: string; repo: string; path: string; content: string;
    message: string; branch: string;
  };

  if (!integrationId || !repo || !path || !message || !branch) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const intg = await getIntegration(integrationId, session.userId);
  if (!intg) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

  const token = decrypt({ encrypted: intg.encrypted_token, iv: intg.token_iv, tag: intg.token_tag });

  try {
    if (intg.provider === "github") {
      const [owner, repoName] = repo.split("/");
      await ghCreateFile(token, owner, repoName, path, content ?? "", message, branch);
    } else {
      const projectId = await glGetProjectId(token, repo);
      await glCreateFile(token, projectId, path, content ?? "", message, branch);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// DELETE /api/repos/file — delete a file
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { integrationId, repo, path, sha, message, branch } = await req.json() as {
    integrationId: string; repo: string; path: string; sha: string;
    message: string; branch: string;
  };

  if (!integrationId || !repo || !path || !sha || !message || !branch) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const intg = await getIntegration(integrationId, session.userId);
  if (!intg) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

  const token = decrypt({ encrypted: intg.encrypted_token, iv: intg.token_iv, tag: intg.token_tag });

  try {
    if (intg.provider === "github") {
      const [owner, repoName] = repo.split("/");
      await ghDeleteFile(token, owner, repoName, path, sha, message, branch);
    } else {
      const projectId = await glGetProjectId(token, repo);
      await glDeleteFile(token, projectId, path, message, branch);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
