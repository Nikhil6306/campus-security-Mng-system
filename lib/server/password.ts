import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing.
 *
 * scrypt from Node's standard library, one random 16-byte salt per account and
 * a constant-time comparison. Plaintext passwords are never written anywhere:
 * the seed script hashes before insert and the login route hashes the attempt.
 */

const KEY_LENGTH = 64;
const SCRYPT_COST = 16384; // N — ~100ms per hash on commodity hardware.

export interface PasswordRecord {
  hash: string;
  salt: string;
}

export function hashPassword(password: string): PasswordRecord {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_COST }).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, record: PasswordRecord): boolean {
  if (!record.hash || !record.salt) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(record.hash, "hex");
  } catch {
    return false;
  }
  const actual = scryptSync(password, record.salt, KEY_LENGTH, { N: SCRYPT_COST });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Opaque, high-entropy identifier for session cookies and pass tokens. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
