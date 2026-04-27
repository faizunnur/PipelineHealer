import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto/encrypt";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  const { error } = await db
    .from("integrations")
    .delete()
    .eq("id", id)
    .eq("user_id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/integrations/[id] — update token and/or provider_user
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { token, provider_user } = await req.json() as { token?: string; provider_user?: string };

  if (!token && !provider_user) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updates: {
    provider_user?: string;
    encrypted_token?: string;
    token_iv?: string;
    token_tag?: string;
  } = {};

  if (provider_user) updates.provider_user = provider_user;

  if (token) {
    const { encrypted, iv, tag } = encrypt(token);
    updates.encrypted_token = encrypted;
    updates.token_iv = iv;
    updates.token_tag = tag;
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("integrations")
    .update(updates)
    .eq("id", id)
    .eq("user_id", session.userId)
    .select("id, provider, provider_user, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ integration: data });
}
