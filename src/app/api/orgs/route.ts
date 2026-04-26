import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";


// GET /api/orgs — list orgs the user belongs to
export async function GET() {
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Get orgs where user is a member
  const { data: memberships } = await admin
    .from("org_members")
    .select(`role, joined_at, organizations(id, name, slug, description, created_at, owner_id)`)
    .eq("user_id", user.id);

  const orgs = (memberships ?? []).map((m) => ({
    ...(m.organizations as Record<string, unknown>),
    role: m.role,
    joined_at: m.joined_at,
  }));

  return NextResponse.json({ orgs });
}

// POST /api/orgs — create a new org
export async function POST(request: NextRequest) {
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, slug, description } = await request.json();
  if (!name || !slug) return NextResponse.json({ error: "name and slug are required" }, { status: 400 });

  // Validate slug
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be 2-40 lowercase alphanumeric chars or hyphens" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check slug uniqueness
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (existing) return NextResponse.json({ error: "Slug already taken" }, { status: 409 });

  // Create org — migration 0006 adds slug/description columns
  const { data: org, error } = await admin
    .from("organizations")
    .insert({
      name,
      slug,
      description: description ?? null,
      owner_id: user.id,
      // provider/provider_org_id made nullable by migration 0006
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add owner as member
  await admin.from("org_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: "owner",
  });

  return NextResponse.json({ org });
}
