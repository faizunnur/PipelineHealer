import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto/encrypt";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["slack", "teams", "discord", "email"]),
  webhookUrl: z.string().url().optional(),
  emailAddress: z.string().email().optional(),
  events: z.array(z.enum(["failure", "healing_complete", "healing_applied", "sla_violation", "security_alert", "weekly_report"])).min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data } = await db
    .from("notification_channels")
    .select("id, name, type, email_address, events, is_active, created_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ channels: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, type, webhookUrl, emailAddress, events } = parsed.data;

  let encryptedWebhook: { encrypted: string; iv: string; tag: string } | null = null;
  if (webhookUrl) encryptedWebhook = encrypt(webhookUrl);

  const db = createAdminClient();
  const { data, error } = await db
    .from("notification_channels")
    .insert({
      user_id: session.userId,
      name,
      type,
      webhook_url: encryptedWebhook?.encrypted ?? null,
      webhook_iv: encryptedWebhook?.iv ?? null,
      webhook_tag: encryptedWebhook?.tag ?? null,
      email_address: emailAddress ?? null,
      events,
    })
    .select("id, name, type, email_address, events, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channel: data }, { status: 201 });
}
