import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return false;
  const db = createAdminClient();
  const { data } = await db.from("profiles").select("role").eq("id", session.userId).single();
  return data?.role === "admin";
}

// PUT /api/admin/templates/[id] — update template
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!await requireAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, title, description, category, provider, content, tags, is_featured, is_official, status } = body;

  type TemplateUpdate = {
    name?: string; title?: string; description?: string; category?: string;
    provider?: string; content?: string; tags?: string[];
    is_featured?: boolean; is_official?: boolean;
    status?: "pending" | "approved" | "rejected";
  };
  const db = createAdminClient();
  const update: TemplateUpdate = {};
  if (name !== undefined) { update.name = name; update.title = title ?? name; }
  if (description !== undefined) update.description = description;
  if (category !== undefined) update.category = category;
  if (provider !== undefined) update.provider = provider;
  if (content !== undefined) update.content = content;
  if (tags !== undefined) update.tags = tags;
  if (is_featured !== undefined) update.is_featured = is_featured;
  if (is_official !== undefined) update.is_official = is_official;
  if (status !== undefined) update.status = status;

  const { data, error } = await db
    .from("pipeline_templates")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

// DELETE /api/admin/templates/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!await requireAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();
  const { error } = await db.from("pipeline_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
