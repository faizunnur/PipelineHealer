import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { orchestrateRollback, fetchRecentCommits } from "@/lib/rollback/rollback-manager";
import { decrypt } from "@/lib/crypto/decrypt";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const pipelineId = searchParams.get("pipelineId");
  const runId = searchParams.get("runId");

  if (!pipelineId) return NextResponse.json({ error: "pipelineId required" }, { status: 400 });

  const db = createAdminClient();

  const { data: history } = await db
    .from("rollback_events")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  let commits: Array<{ sha: string; message: string; date: string; author: string }> = [];
  if (runId) {
    const { data: pipeline } = await db
      .from("pipelines")
      .select("repo_full_name, provider, integrations(encrypted_token, token_iv, token_tag)")
      .eq("id", pipelineId)
      .eq("user_id", session.userId)
      .single();

    const pipelineData = pipeline as {
      repo_full_name: string;
      provider: string;
      integrations: { encrypted_token: string; token_iv: string; token_tag: string };
    } | null;

    if (pipelineData?.provider === "github") {
      const { data: run } = await db
        .from("pipeline_runs")
        .select("branch, commit_sha")
        .eq("id", runId)
        .single();

      const branch = run?.branch ?? "main";
      const plainToken = decrypt({
        encrypted: pipelineData.integrations.encrypted_token,
        iv: pipelineData.integrations.token_iv,
        tag: pipelineData.integrations.token_tag,
      });

      try {
        commits = await fetchRecentCommits(plainToken, pipelineData.repo_full_name, branch);
      } catch {
        // non-fatal, return empty commits
      }
    }
  }

  return NextResponse.json({ history: history ?? [], commits });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pipelineId, runId, targetSha, reason } = await request.json();
  if (!pipelineId || !runId || !targetSha) {
    return NextResponse.json({ error: "pipelineId, runId, targetSha required" }, { status: 400 });
  }

  const result = await orchestrateRollback(
    session.userId,
    pipelineId,
    runId,
    targetSha,
    reason ?? "Manual rollback via PipelineHealer"
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, sha: result.sha });
}
