import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email: string; password: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: profile } = await db
    .from("profiles")
    .select("id, email, password_hash, is_suspended, email_verified")
    .eq("email", email)
    .maybeSingle();

  if (!profile || !profile.password_hash) {
    // Constant-time-like response to avoid user enumeration
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await verifyPassword(password, profile.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (!profile.email_verified) {
    return NextResponse.json({ error: "email_not_verified" }, { status: 403 });
  }

  if (profile.is_suspended) {
    return NextResponse.json({ error: "Account suspended. Please contact support." }, { status: 403 });
  }

  const token = await createSession({ userId: profile.id, email: profile.email });
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, token);
  return response;
}
