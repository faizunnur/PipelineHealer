import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const pipelineId = url.searchParams.get("pipelineId");

  const db = createAdminClient();
  let query = db
    .from("flaky_tests")
    .select(`*, pipelines(repo_full_name)`)
    .eq("user_id", session.userId)
    .eq("is_suppressed", false)
    .order("flakiness_score", { ascending: false })
    .limit(50);

  if (pipelineId) query = query.eq("pipeline_id", pipelineId);

  const { data } = await query;
  return NextResponse.json({ tests: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const body = await req.json();

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db
    .from("flaky_tests")
    .update({ is_suppressed: body.is_suppressed })
    .eq("id", id)
    .eq("user_id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
