import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

async function getOrgWithRole(orgId: string, userId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("org_members")
    .select("role, organizations(*)")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single();
  return data;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getOrgWithRole(orgId, session.userId);
  if (!membership) return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });

  const db = createAdminClient();
  const { data: members } = await db
    .from("org_members")
    .select("user_id, role, joined_at, profiles(full_name, email, avatar_url)")
    .eq("org_id", orgId);

  return NextResponse.json({ org: membership.organizations, role: membership.role, members: members ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getOrgWithRole(orgId, session.userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { name, description } = await request.json();
  const db = createAdminClient();

  const { data: org, error } = await db
    .from("organizations")
    .update({ name, description })
    .eq("id", orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ org });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getOrgWithRole(orgId, session.userId);
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can delete an org" }, { status: 403 });
  }

  const db = createAdminClient();
  await db.from("org_members").delete().eq("org_id", orgId);
  await db.from("organizations").delete().eq("id", orgId);

  return NextResponse.json({ success: true });
}
