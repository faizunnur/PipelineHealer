import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  let query = db
    .from("pipeline_templates")
    .select("*")
    .eq("status", "approved")
    .order("use_count", { ascending: false });

  if (category && category !== "all") query = query.eq("category", category);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data } = await query.limit(50);
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, category, provider, content, tags } = await request.json();
  if (!name || !description || !category || !provider || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("pipeline_templates")
    .insert({
      title: name,
      name,
      description, category, provider, content, tags: tags ?? [],
      created_by: session.userId,
      author_id: session.userId,
      is_official: false,
      use_count: 0,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = createAdminClient();
  const { data: template } = await db
    .from("pipeline_templates")
    .select("use_count")
    .eq("id", id)
    .single();

  await db
    .from("pipeline_templates")
    .update({ use_count: (template?.use_count ?? 0) + 1 })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
