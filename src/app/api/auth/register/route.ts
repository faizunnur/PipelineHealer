import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";
import { sendVerificationEmail } from "@/lib/email/mailer";
import { randomUUID, randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const { email, password, full_name } = await req.json() as {
    email: string;
    password: string;
    full_name: string;
  };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const db = createAdminClient();

  // Check if email already exists
  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "email_exists" }, { status: 409 });
  }

  const password_hash = await hashPassword(password);
  const userId = randomUUID();

  const { error } = await db.from("profiles").insert({
    id: userId,
    email,
    full_name: full_name || null,
    password_hash,
    role: "user",
    is_suspended: false,
    approval_mode: "manual",
    token_budget: 100000,
    tokens_used: 0,
    email_verified: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Generate verification token (1-hour expiry)
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await db.from("email_verification_tokens").insert({ user_id: userId, token, expires_at: expiresAt });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  try {
    await sendVerificationEmail(email, verifyUrl);
  } catch (err) {
    console.error("[register] SMTP error:", err);
    // Don't fail registration if email fails — user can request resend
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
