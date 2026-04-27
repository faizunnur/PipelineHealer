import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { postPRComment, findPRForCommit } from "@/lib/github/pr-commenter";
import { decrypt } from "@/lib/crypto/decrypt";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { healingEventId } = await request.json();
  if (!healingEventId) return NextResponse.json({ error: "healingEventId required" }, { status: 400 });

  const db = createAdminClient();
  const { data: event } = await db
    .from("healing_events")
    .select(`*, pipelines(provider, repo_full_name, integrations(encrypted_token, token_iv, token_tag))`)
    .eq("id", healingEventId)
    .eq("user_id", session.userId)
    .single();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const pipeline = event.pipelines as {
    provider: string;
    repo_full_name: string;
    integrations: { encrypted_token: string; token_iv: string; token_tag: string };
  } | null;

  if (!pipeline || pipeline.provider !== "github") {
    return NextResponse.json({ error: "PR comments only supported for GitHub" }, { status: 400 });
  }

  const plainToken = decrypt({
    encrypted: pipeline.integrations.encrypted_token,
    iv: pipeline.integrations.token_iv,
    tag: pipeline.integrations.token_tag,
  });

  const { data: run } = await db
    .from("pipeline_runs")
    .select("commit_sha")
    .eq("id", event.run_id)
    .single();

  const commitSha = run?.commit_sha;
  if (!commitSha) return NextResponse.json({ error: "No commit SHA found for this run" }, { status: 400 });

  const prNumber = await findPRForCommit(plainToken, pipeline.repo_full_name, commitSha);
  if (!prNumber) return NextResponse.json({ error: "No open PR found for this commit" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";

  await postPRComment({
    token: plainToken,
    repoFullName: pipeline.repo_full_name,
    prNumber,
    reason: event.ai_reason ?? "Unknown error",
    solution: event.ai_solution ?? "No solution generated",
    filePath: event.ai_file_path,
    originalCode: event.ai_original_code,
    fixedCode: event.ai_fixed_code,
    healingEventId: event.id,
    appUrl,
  });

  return NextResponse.json({ success: true, prNumber });
}
