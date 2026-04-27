import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto/encrypt";
import { randomBytes } from "crypto";
import { z } from "zod";

const createSchema = z.object({
  provider: z.enum(["github", "gitlab"]),
  token: z.string().min(10),
  providerUser: z.string().min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data } = await db
    .from("integrations")
    .select("id, provider, provider_user, is_active, created_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ integrations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { provider, token, providerUser } = parsed.data;
  const encryptedPayload = encrypt(token);
  const webhookSecret = randomBytes(32).toString("hex");

  const db = createAdminClient();
  const { data, error } = await db
    .from("integrations")
    .insert({
      user_id: session.userId,
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
      return NextResponse.json({ error: "Integration already exists for this account" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ integration: data }, { status: 201 });
}
