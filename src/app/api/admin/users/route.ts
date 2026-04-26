import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return null;
  return user;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const adminUser = await requireAdmin(supabase);
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = parseInt(url.searchParams.get("limit") ?? "20");
  const offset = (page - 1) * limit;

  const adminClient = createAdminClient();

  const { data, count } = await adminClient
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return NextResponse.json({
    users: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}

const updateSchema = z.object({
  is_suspended: z.boolean().optional(),
  token_budget: z.number().int().min(0).optional(),
  role: z.enum(["user", "admin"]).optional(),
  approval_mode: z.enum(["manual", "auto"]).optional(),
});

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const adminUser = await requireAdmin(supabase);
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .update(parsed.data)
    .eq("id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ user: data });
}
