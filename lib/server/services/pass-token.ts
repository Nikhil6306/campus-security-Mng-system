import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signed QR pass tokens.
 *
 * Format: `<nonce>.<hmac_base64url>`
 *  - `nonce`: 24 random bytes (48 hex chars), unique per booking.
 *  - `hmac`: HMAC-SHA256 over `nonce`, preventing forged or tampered QR tokens
 *    before any database lookup is trusted.
 */

function getPassSecret(): string {
  const secret =
    process.env.PASS_TOKEN_SECRET?.trim() ||
    process.env.JWT_ACCESS_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PASS_TOKEN_SECRET or JWT_ACCESS_SECRET must be set in production.");
  }
  return "csms-local-dev-pass-token-secret";
}

/** Generates a new HMAC-SHA256 signed QR pass token. */
export function signPassToken(nonce = randomBytes(24).toString("hex")): string {
  const sig = createHmac("sha256", getPassSecret()).update(nonce).digest("base64url");
  return `${nonce}.${sig}`;
}

/**
 * Verifies the HMAC-SHA256 signature on a signed QR pass token.
 * Legacy unsigned tokens (no `.` separator) return `true` only if they are
 * 48-char hex strings and still have to match a DB row; any token containing
 * `.` must pass constant-time HMAC verification.
 */
export function verifyPassTokenSignature(token: string): boolean {
  const trimmed = token.trim();
  const dot = trimmed.indexOf(".");
  if (dot === -1) {
    return /^[0-9a-f]{48}$/i.test(trimmed);
  }
  const nonce = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (!nonce || !sig) return false;

  const expected = createHmac("sha256", getPassSecret()).update(nonce).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
