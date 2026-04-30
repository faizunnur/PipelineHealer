import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get("pipelineId");
  const type = searchParams.get("type");

  const db = createAdminClient();
  let query = db
    .from("pipeline_artifacts")
    .select(`
      id, pipeline_id, run_id, name, type, url, version,
      size_bytes, metadata, created_at,
      pipelines ( id, repo_full_name, provider )
    `)
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (pipelineId) query = query.eq("pipeline_id", pipelineId);
  if (type) query = query.eq("type", type as "docker" | "npm" | "s3" | "github-release" | "pypi" | "other");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ artifacts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { pipeline_id, run_id, name, type, url, version, size_bytes, metadata } = body;

  if (!pipeline_id || !name || !type) {
    return NextResponse.json({ error: "pipeline_id, name, and type are required" }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: pipeline } = await db
    .from("pipelines")
    .select("id")
    .eq("id", pipeline_id)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  const { data, error } = await db
    .from("pipeline_artifacts")
    .insert({
      pipeline_id,
      user_id: session.userId,
      run_id: run_id ?? null,
      name,
      type,
      url: url ?? null,
      version: version ?? null,
      size_bytes: size_bytes ?? null,
      metadata: metadata ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ artifact: data });
}
