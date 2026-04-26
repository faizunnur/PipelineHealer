import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";


// POST /api/orgs/[orgId]/members — invite by email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Check invoker is owner/admin
  const { data: invokerMembership } = await admin
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!invokerMembership || !["owner", "admin"].includes(invokerMembership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { email, role } = await request.json() as { email: string; role: "admin" | "member" | "viewer" };
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  if (!["admin", "member", "viewer"].includes(role ?? "member")) {
    return NextResponse.json({ error: "role must be admin, member, or viewer" }, { status: 400 });
  }

  // Find user by email
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .eq("email", email)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No user found with that email. They must register first." }, { status: 404 });
  }

  // Check not already a member
  const { data: existing } = await admin
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", profile.id)
    .single();

  if (existing) return NextResponse.json({ error: "User is already a member" }, { status: 409 });

  const { data: member, error } = await admin
    .from("org_members")
    .insert({ org_id: orgId, user_id: profile.id, role: role ?? "member" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member, user: profile });
}

// PATCH /api/orgs/[orgId]/members — update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: invokerMembership } = await admin
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!invokerMembership || !["owner", "admin"].includes(invokerMembership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { userId, role } = await request.json() as { userId: string; role: "admin" | "member" | "viewer" };
  if (!userId || !role) return NextResponse.json({ error: "userId and role required" }, { status: 400 });

  // Can't change owner role
  const { data: targetMembership } = await admin
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single();
  if (targetMembership?.role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
  }

  await admin
    .from("org_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId);

  return NextResponse.json({ success: true });
}

// DELETE /api/orgs/[orgId]/members — remove a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");

  // Allow leaving org yourself, or owner/admin removing others
  if (targetUserId !== user.id) {
    const { data: invokerMembership } = await admin
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!invokerMembership || !["owner", "admin"].includes(invokerMembership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { data: targetMembership } = await admin
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId ?? "")
      .single();
    if (targetMembership?.role === "owner") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
    }
  }

  await admin
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", targetUserId ?? user.id);

  return NextResponse.json({ success: true });
}
