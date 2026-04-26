import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const pipelineId = url.searchParams.get("pipelineId");

  let query = supabase
    .from("flaky_tests")
    .select(`*, pipelines(repo_full_name)`)
    .eq("user_id", user.id)
    .eq("is_suppressed", false)
    .order("flakiness_score", { ascending: false })
    .limit(50);

  if (pipelineId) {
    query = query.eq("pipeline_id", pipelineId);
  }

  const { data } = await query;
  return NextResponse.json({ tests: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const body = await req.json();

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("flaky_tests")
    .update({ is_suppressed: body.is_suppressed })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
