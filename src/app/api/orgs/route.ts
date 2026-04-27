import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: memberships } = await db
    .from("org_members")
    .select(`role, joined_at, organizations(id, name, slug, description, created_at, owner_id)`)
    .eq("user_id", session.userId);

  const orgs = (memberships ?? []).map((m) => ({
    ...(m.organizations as Record<string, unknown>),
    role: m.role,
    joined_at: m.joined_at,
  }));

  return NextResponse.json({ orgs });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, slug, description } = await request.json();
  if (!name || !slug) return NextResponse.json({ error: "name and slug are required" }, { status: 400 });

  if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be 2-40 lowercase alphanumeric chars or hyphens" }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: existing } = await db
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (existing) return NextResponse.json({ error: "Slug already taken" }, { status: 409 });

  const { data: org, error } = await db
    .from("organizations")
    .insert({ name, slug, description: description ?? null, owner_id: session.userId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("org_members").insert({ org_id: org.id, user_id: session.userId, role: "owner" });

  return NextResponse.json({ org });
}
