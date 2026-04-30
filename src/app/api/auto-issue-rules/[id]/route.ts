import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { is_active, consecutive_failures, labels, assignees } = body;

  const db = createAdminClient();

  type RuleUpdate = { is_active?: boolean; consecutive_failures?: number; labels?: string[]; assignees?: string[] };
  const update: RuleUpdate = {};
  if (is_active !== undefined) update.is_active = is_active;
  if (consecutive_failures !== undefined) update.consecutive_failures = consecutive_failures;
  if (labels !== undefined) update.labels = labels;
  if (assignees !== undefined) update.assignees = assignees;

  const { data, error } = await db
    .from("auto_issue_rules")
    .update(update)
    .eq("id", id)
    .eq("user_id", session.userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rule: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  const { error } = await db
    .from("auto_issue_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
