import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";


async function getOrgWithRole(orgId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_members")
    .select("role, organizations(*)")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single();
  return data;
}

// GET /api/orgs/[orgId] — org details + members
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getOrgWithRole(orgId, user.id);
  if (!membership) return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("org_members")
    .select("user_id, role, joined_at, profiles(full_name, email, avatar_url)")
    .eq("org_id", orgId);

  return NextResponse.json({
    org: membership.organizations,
    role: membership.role,
    members: members ?? [],
  });
}

// PATCH /api/orgs/[orgId] — update org (owner/admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getOrgWithRole(orgId, user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { name, description } = await request.json();
  const admin = createAdminClient();

  const { data: org, error } = await admin
    .from("organizations")
    .update({ name, description })
    .eq("id", orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ org });
}

// DELETE /api/orgs/[orgId] — delete org (owner only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getOrgWithRole(orgId, user.id);
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can delete an org" }, { status: 403 });
  }

  const admin = createAdminClient();
  await admin.from("org_members").delete().eq("org_id", orgId);
  await admin.from("organizations").delete().eq("id", orgId);

  return NextResponse.json({ success: true });
}
