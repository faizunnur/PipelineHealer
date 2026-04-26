import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto/encrypt";
import { randomBytes } from "crypto";
import { z } from "zod";

const createSchema = z.object({
  provider: z.enum(["github", "gitlab"]),
  token: z.string().min(10),
  providerUser: z.string().min(1),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("integrations")
    .select("id, provider, provider_user, is_active, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ integrations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { provider, token, providerUser } = parsed.data;

  // Encrypt the token
  const encryptedPayload = encrypt(token);
  const webhookSecret = randomBytes(32).toString("hex");

  const { data, error } = await supabase
    .from("integrations")
    .insert({
      user_id: user.id,
      provider,
      provider_user: providerUser,
      encrypted_token: encryptedPayload.encrypted,
      token_iv: encryptedPayload.iv,
      token_tag: encryptedPayload.tag,
      webhook_secret: webhookSecret,
    })
    .select("id, provider, provider_user, is_active, created_at, webhook_secret")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Integration already exists for this account" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ integration: data }, { status: 201 });
}
