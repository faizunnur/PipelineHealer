import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  const { data: invokerMembership } = await db
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", session.userId)
    .single();

  if (!invokerMembership || !["owner", "admin"].includes(invokerMembership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { email, role } = await request.json() as { email: string; role: "admin" | "member" | "viewer" };
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  if (!["admin", "member", "viewer"].includes(role ?? "member")) {
    return NextResponse.json({ error: "role must be admin, member, or viewer" }, { status: 400 });
  }

  const { data: profile } = await db
    .from("profiles")
    .select("id, email, full_name")
    .eq("email", email)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No user found with that email. They must register first." }, { status: 404 });
  }

  const { data: existing } = await db
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", profile.id)
    .single();

  if (existing) return NextResponse.json({ error: "User is already a member" }, { status: 409 });

  const { data: member, error } = await db
    .from("org_members")
    .insert({ org_id: orgId, user_id: profile.id, role: role ?? "member" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member, user: profile });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  const { data: invokerMembership } = await db
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", session.userId)
    .single();

  if (!invokerMembership || !["owner", "admin"].includes(invokerMembership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { userId, role } = await request.json() as { userId: string; role: "admin" | "member" | "viewer" };
  if (!userId || !role) return NextResponse.json({ error: "userId and role required" }, { status: 400 });

  const { data: targetMembership } = await db
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single();
  if (targetMembership?.role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
  }

  await db.from("org_members").update({ role }).eq("org_id", orgId).eq("user_id", userId);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");

  if (targetUserId !== session.userId) {
    const { data: invokerMembership } = await db
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", session.userId)
      .single();

    if (!invokerMembership || !["owner", "admin"].includes(invokerMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { data: targetMembership } = await db
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId ?? "")
      .single();
    if (targetMembership?.role === "owner") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
    }
  }

  await db
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", targetUserId ?? session.userId);

  return NextResponse.json({ success: true });
}
