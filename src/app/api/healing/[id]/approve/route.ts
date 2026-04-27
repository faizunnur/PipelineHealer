import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyFix } from "@/lib/healing/orchestrator";
import { z } from "zod";

const schema = z.object({ confirm: z.literal(true) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = await params;
  const db = createAdminClient();

  const { data: event } = await db
    .from("healing_events")
    .select("id, status, user_id")
    .eq("id", id)
    .single();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.user_id !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["pending_review", "apply_failed"].includes(event.status)) {
    return NextResponse.json({ error: `Cannot approve event in status: ${event.status}` }, { status: 400 });
  }

  const result = await applyFix(id, session.userId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
