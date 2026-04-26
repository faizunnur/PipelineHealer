import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto/encrypt";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// PATCH /api/integrations/[id] — update token and/or provider_user
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const { data, error } = await supabase
    .from("integrations")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, provider, provider_user, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ integration: data });
}
