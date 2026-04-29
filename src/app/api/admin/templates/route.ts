import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return false;
  const db = createAdminClient();
  const { data } = await db.from("profiles").select("role").eq("id", session.userId).single();
  return data?.role === "admin";
}

// GET /api/admin/templates — all templates (any status)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!await requireAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = db
    .from("pipeline_templates")
    .select("*, profiles(email, full_name)")
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status as "pending" | "approved" | "rejected");

  const { data } = await query;
  return NextResponse.json({ templates: data ?? [] });
}

// POST /api/admin/templates — create official template
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!await requireAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, title, description, category, provider, content, tags, is_featured, is_official } = body;
  if (!name || !description || !category || !provider || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("pipeline_templates")
    .insert({
      title: title ?? name,
      name,
      description,
      category,
      provider,
      content,
      tags: tags ?? [],
      created_by: session!.userId,
      author_id: session!.userId,
      is_official: is_official ?? true,
      is_featured: is_featured ?? false,
      use_count: 0,
      status: "approved",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data }, { status: 201 });
}
