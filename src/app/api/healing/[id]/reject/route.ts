import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: event } = await db
    .from("healing_events")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.user_id !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (event.status !== "pending_review") {
    return NextResponse.json({ error: "Can only reject pending events" }, { status: 400 });
  }

  await db.from("healing_events").update({ status: "rejected" }).eq("id", id);
  return NextResponse.json({ ok: true });
}
