import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const createSchema = z.object({
  pipeline_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  metric: z.enum(["max_duration", "max_failures_per_day", "max_consecutive_failures", "min_success_rate"]),
  threshold: z.number().positive(),
  window_hours: z.number().int().min(1).max(720).default(24),
  notify_channel_id: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const pipelineId = url.searchParams.get("pipelineId");

  const db = createAdminClient();
  let query = db
    .from("sla_rules")
    .select(`*, pipelines(repo_full_name), sla_violations(id, actual_value, threshold, created_at)`)
    .eq("user_id", session.userId);

  if (pipelineId) query = query.eq("pipeline_id", pipelineId);

  const { data } = await query.order("created_at", { ascending: false });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const db = createAdminClient();

  // Verify pipeline ownership
  const { data: pipeline } = await db
    .from("pipelines")
    .select("id")
    .eq("id", parsed.data.pipeline_id)
    .eq("user_id", session.userId)
    .single();
  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  const { data, error } = await db
    .from("sla_rules")
    .insert({ ...parsed.data, user_id: session.userId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const db = createAdminClient();

  await db.from("sla_rules").delete().eq("id", id!).eq("user_id", session.userId);
  return NextResponse.json({ ok: true });
}
