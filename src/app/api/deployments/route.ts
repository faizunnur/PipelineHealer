import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get("pipelineId");
  const environment = searchParams.get("environment");

  const db = createAdminClient();
  let query = db
    .from("deployments")
    .select(`
      id, pipeline_id, run_id, environment, custom_env_name, status,
      version, deployed_at, deployed_by, approved_by, approved_at,
      requires_approval, notes, created_at,
      pipelines ( id, repo_full_name, provider, default_branch, last_status )
    `)
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (pipelineId) query = query.eq("pipeline_id", pipelineId);
  if (environment) query = query.eq("environment", environment as "dev" | "staging" | "production" | "custom");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deployments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { pipeline_id, run_id, environment, custom_env_name, version, notes, requires_approval } = body;

  const env = environment as "dev" | "staging" | "production" | "custom";
  if (!pipeline_id || !env) {
    return NextResponse.json({ error: "pipeline_id and environment are required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Verify pipeline belongs to user
  const { data: pipeline } = await db
    .from("pipelines")
    .select("id, repo_full_name")
    .eq("id", pipeline_id)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  const status = requires_approval ? "pending_approval" : "deployed";

  const { data, error } = await db
    .from("deployments")
    .insert({
      pipeline_id,
      user_id: session.userId,
      run_id: run_id ?? null,
      environment: env,
      custom_env_name: custom_env_name ?? null,
      status,
      version: version ?? null,
      notes: notes ?? null,
      requires_approval: requires_approval ?? false,
      deployed_at: requires_approval ? null : new Date().toISOString(),
      deployed_by: session.email ?? session.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deployment: data });
}
