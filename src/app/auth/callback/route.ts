import { NextResponse } from "next/server";

// OAuth callback is no longer used — authentication is handled via custom JWT auth.
// This route is kept to avoid 404 errors from any stale links.
export async function GET() {
  return NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  );
}
