import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Aadhaar at rest.
 *
 * Aadhaar numbers are sensitive identity data, so this module is the only
 * place in the codebase that ever holds one in plaintext, and nothing it
 * returns to a caller contains the full number.
 *
 * TWO MODES, chosen by whether `AADHAAR_ENCRYPTION_KEY` is set:
 *
 *  - **Encrypted** (key present). The number is sealed with AES-256-GCM under
 *    a random 96-bit IV; the stored value is `v1.<iv>.<tag>.<ciphertext>`,
 *    base64url. A keyed HMAC-SHA-256 is stored alongside so duplicates can be
 *    detected without ever comparing plaintext. Rotating the key makes old
 *    ciphertext unreadable by design — see `docs` note in `.env.example`.
 *
 *  - **Minimised** (no key). Nothing but the last four digits is persisted.
 *    The system keeps working and the admin UI keeps showing `XXXXXXXX1234`;
 *    it simply cannot reproduce the full number. This is the safe default: an
 *    operator who has not deliberately configured a key never accumulates a
 *    store of recoverable Aadhaar numbers.
 *
 * In both modes `last4` is the only fragment any API, log line, QR code or
 * WhatsApp message is permitted to carry.
 */

const VERSION = "v1";

/**
 * Digits only.
 *
 * Deliberately local rather than imported: this module is the single point
 * where a plaintext Aadhaar number exists, and keeping it free of internal
 * imports means it can be reviewed, and exercised by the test suite, entirely
 * on its own. It mirrors `normaliseAadhaar` in `lib/validation.ts`.
 */
const digitsOnly = (value: string): string => value.replace(/[^\d]/g, "");

export interface SealedAadhaar {
  /** AES-256-GCM envelope, or null when running without a key. */
  ciphertext: string | null;
  /** Keyed digest for duplicate detection; null without a key. */
  hash: string | null;
  /** Always present — the only fragment safe to display. */
  last4: string;
}

function keyMaterial(): Buffer | null {
  const raw = process.env.AADHAAR_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  // Accept base64 or hex so an operator can paste whichever their key manager
  // produced; both must decode to exactly 32 bytes.
  const buffer = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (buffer.length !== 32) {
    throw new Error(
      "AADHAAR_ENCRYPTION_KEY must decode to 32 bytes (base64 or 64 hex characters).",
    );
  }
  return buffer;
}

/** True when the deployment is configured to retain recoverable numbers. */
export function encryptionEnabled(): boolean {
  return keyMaterial() !== null;
}

/**
 * Prepares an Aadhaar number for storage.
 *
 * Accepts the grouped spelling a visitor types; the caller must have already
 * validated the format. Throws only on a programming error (a non-12-digit
 * value reaching storage), never on a configuration gap.
 */
export function sealAadhaar(input: string): SealedAadhaar {
  const digits = digitsOnly(input);
  if (digits.length !== 12) {
    throw new Error("sealAadhaar received a value that is not 12 digits.");
  }

  const last4 = digits.slice(-4);
  const key = keyMaterial();
  if (!key) return { ciphertext: null, hash: null, last4 };

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const sealed = Buffer.concat([cipher.update(digits, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: [
      VERSION,
      iv.toString("base64url"),
      tag.toString("base64url"),
      sealed.toString("base64url"),
    ].join("."),
    hash: createHmac("sha256", key).update(digits).digest("base64url"),
    last4,
  };
}

/**
 * Recovers a stored number.
 *
 * Deliberately not wired into any route or UI: it exists so an operator can
 * satisfy a lawful, audited request from a server-side script. Returns null
 * when the record was stored without a key, or when the envelope does not
 * authenticate under the current key.
 */
export function openAadhaar(ciphertext: string | null): string | null {
  if (!ciphertext) return null;
  const key = keyMaterial();
  if (!key) return null;

  const [version, iv, tag, payload] = ciphertext.split(".");
  if (version !== VERSION || !iv || !tag || !payload) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(payload, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key or tampered ciphertext — indistinguishable on purpose.
    return null;
  }
}

/** Constant-time comparison of two stored digests. */
export function sameAadhaar(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
