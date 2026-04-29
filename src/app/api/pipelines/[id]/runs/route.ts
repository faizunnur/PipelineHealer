import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/pipelines/[id]/runs — polled by the live runs component
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  // Verify ownership
  const { data: pipeline } = await db
    .from("pipelines")
    .select("id, last_status, webhook_status")
    .eq("id", id)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: runs } = await db
    .from("pipeline_runs")
    .select(
      `id, status, branch, commit_sha, commit_message, triggered_by,
       started_at, completed_at, duration_seconds, created_at,
       pipeline_jobs(id, job_name, status, duration_seconds, error_excerpt)`
    )
    .eq("pipeline_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    runs: runs ?? [],
    pipelineStatus: pipeline.last_status,
  });
}
