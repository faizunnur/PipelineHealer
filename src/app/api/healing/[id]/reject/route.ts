import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: event } = await supabase
    .from("healing_events")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.user_id !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (event.status !== "pending_review") {
    return NextResponse.json(
      { error: "Can only reject pending events" },
      { status: 400 }
    );
  }

  await supabase
    .from("healing_events")
    .update({ status: "rejected" })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
