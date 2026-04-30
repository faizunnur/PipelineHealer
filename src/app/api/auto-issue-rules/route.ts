import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get("pipelineId");

  const db = createAdminClient();
  let query = db
    .from("auto_issue_rules")
    .select(`
      id, pipeline_id, is_active, consecutive_failures, labels, assignees, created_at,
      pipelines ( id, repo_full_name, provider )
    `)
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  if (pipelineId) query = query.eq("pipeline_id", pipelineId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { pipeline_id, consecutive_failures = 3, labels = ["ci-failure", "automated"], assignees = [] } = body;

  if (!pipeline_id) return NextResponse.json({ error: "pipeline_id is required" }, { status: 400 });

  const db = createAdminClient();

  const { data: pipeline } = await db
    .from("pipelines")
    .select("id")
    .eq("id", pipeline_id)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  const { data, error } = await db
    .from("auto_issue_rules")
    .upsert(
      { pipeline_id, user_id: session.userId, consecutive_failures, labels, assignees, is_active: true },
      { onConflict: "pipeline_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rule: data });
}
