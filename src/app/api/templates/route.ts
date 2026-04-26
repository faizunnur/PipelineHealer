import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";


// GET /api/templates?category=&search= — list public templates + user's own
export async function GET(request: NextRequest) {
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  let query = admin
    .from("pipeline_templates")
    .select("*")
    .order("use_count", { ascending: false });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data } = await query.limit(50);
  return NextResponse.json({ templates: data ?? [] });
}

// POST /api/templates — submit a new template
export async function POST(request: NextRequest) {
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, category, provider, content, tags } = await request.json();
  if (!name || !description || !category || !provider || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pipeline_templates")
    .insert({
      title: name,   // existing column
      name,          // new alias column from migration 0006
      description, category, provider, content, tags: tags ?? [],
      created_by: user.id,  // existing column
      author_id: user.id,   // new alias column
      is_official: false,
      use_count: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

// PATCH /api/templates?id= — increment use count
export async function PATCH(request: NextRequest) {
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: template } = await admin
    .from("pipeline_templates")
    .select("use_count")
    .eq("id", id)
    .single();

  await admin
    .from("pipeline_templates")
    .update({ use_count: (template?.use_count ?? 0) + 1 })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
