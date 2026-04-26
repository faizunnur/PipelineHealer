import { createHmac, timingSafeEqual } from "crypto";

export function verifyGitHubSignature(
  payload: string,
  secret: string,
  signature: string
): boolean {
  if (!signature.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function verifyGitLabToken(
  token: string,
  secret: string
): boolean {
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}
