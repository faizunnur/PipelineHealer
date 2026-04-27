import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/pipeline-runs?pipelineId=xxx — get runs for a pipeline the user owns
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get("pipelineId");
  if (!pipelineId) return NextResponse.json({ error: "pipelineId required" }, { status: 400 });

  const db = createAdminClient();

  // Verify ownership
  const { data: pipeline } = await db
    .from("pipelines")
    .select("id")
    .eq("id", pipelineId)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  const { data: runs } = await db
    .from("pipeline_runs")
    .select("id, status, branch, created_at, commit_sha")
    .eq("pipeline_id", pipelineId)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ runs: runs ?? [] });
}
