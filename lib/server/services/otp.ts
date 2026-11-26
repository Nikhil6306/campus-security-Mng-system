/**
 * OTP management service for the DSVV Campus Security Management System.
 *
 * Implements:
 * - Cryptographically secure 6-digit OTP generation (node:crypto randomInt)
 * - Secure hashing via scrypt (never plain text)
 * - 5-minute expiry (configurable via OTP_EXPIRY_MINUTES)
 * - 60-second resend cooldown per (email, purpose)
 * - Max 5 attempts with attempt tracking
 * - Purpose isolation (signup, password_reset, email_change_old, email_change_new)
 * - Anti-enumeration for password recovery
 * - Single-use consumption
 * - EmailJS delivery with Resend fallback and dev simulation
 * - Storage in Supabase `auth_email_otps` with SQLite fallback
 */

import "server-only";

import { randomInt } from "node:crypto";
import { get, run, tx } from "../db";
import { hashPassword, randomToken, verifyPassword } from "../password";
import { AuthError } from "../auth";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { sendOtpEmail } from "@/lib/email/email-service";
import { OTP_CONFIG } from "@/lib/email/email-config";
import type { OtpPurpose } from "@/lib/email/email-templates";

export interface AuthEmailOtpRecord {
  id: string;
  user_id: string | null;
  email: string;
  otp_hash: string;
  otp_salt: string;
  purpose: OtpPurpose;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  verified_at: string | null;
  consumed_at: string | null;
  created_at: string;
}

// ---- OTP Generation & Dispatch ----------------------------------------------

export async function createAndSendOtp(params: {
  email: string;
  purpose: OtpPurpose;
  userId?: string | null;
  recipientName?: string;
}): Promise<{ ok: boolean; message: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const purpose = params.purpose;
  const cooldownSeconds = OTP_CONFIG.resendCooldownSeconds;
  const expiryMinutes = OTP_CONFIG.expiryMinutes;
  const maxAttempts = OTP_CONFIG.maxAttempts;

  // 1. Enforce Resend Cooldown (60 seconds)
  const recent = get<AuthEmailOtpRecord>(
    `SELECT * FROM auth_email_otps
      WHERE lower(email) = lower(?)
        AND purpose = ?
        AND consumed_at IS NULL
        AND datetime(created_at, '+${cooldownSeconds} seconds') > datetime('now')
      ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail, purpose],
  );

  if (recent) {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(recent.created_at).getTime()) / 1000),
    );
    const waitSeconds = Math.max(1, cooldownSeconds - elapsedSeconds);
    throw new AuthError(
      `Please wait ${waitSeconds} seconds before requesting another verification code.`,
      429,
    );
  }

  // 2. Generate cryptographically secure 6-digit OTP
  const rawOtp = randomInt(100000, 999999).toString();

  // 3. Hash OTP before storing (never plaintext)
  const { hash: otpHash, salt: otpSalt } = hashPassword(rawOtp);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);
  const id = `otp-${randomToken().slice(0, 16)}`;

  // 4. Invalidate previous active OTPs for this email + purpose, then insert new one
  tx(() => {
    run(
      `UPDATE auth_email_otps
          SET consumed_at = ?
        WHERE lower(email) = lower(?)
          AND purpose = ?
          AND consumed_at IS NULL`,
      [now.toISOString(), cleanEmail, purpose],
    );

    run(
      `INSERT INTO auth_email_otps (
        id, user_id, email, otp_hash, otp_salt, purpose,
        expires_at, attempts, max_attempts, verified_at, consumed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, ?)`,
      [
        id,
        params.userId ?? null,
        cleanEmail,
        otpHash,
        otpSalt,
        purpose,
        expiresAt.toISOString(),
        maxAttempts,
        now.toISOString(),
      ],
    );

    // Also write to legacy password_reset_otps for backwards compatibility if purpose is password_reset
    if (purpose === "password_reset") {
      run(
        "UPDATE password_reset_otps SET used_at = ? WHERE lower(email) = lower(?) AND used_at IS NULL",
        [now.toISOString(), cleanEmail],
      );
      run(
        `INSERT INTO password_reset_otps (id, email, otp_hash, salt, attempts, max_attempts, created_at, expires_at, used_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL)`,
        [id, cleanEmail, otpHash, otpSalt, maxAttempts, now.toISOString(), expiresAt.toISOString()],
      );
    }
  });

  // Also persist to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      await admin.from("auth_email_otps").insert({
        id,
        user_id: params.userId || null,
        email: cleanEmail,
        otp_hash: otpHash,
        otp_salt: otpSalt,
        purpose,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        max_attempts: maxAttempts,
        created_at: now.toISOString(),
      });
    } catch (sbErr) {
      console.warn("[otp] Supabase auth_email_otps insert warning:", (sbErr as Error).message);
    }
  }

  // 5. Dispatch email via EmailJS (with Resend fallback / dev simulation)
  const recipientName = params.recipientName ?? cleanEmail.split("@")[0];
  await sendOtpEmail({
    toEmail: cleanEmail,
    toName: recipientName,
    otp: rawOtp,
    purpose,
    userId: params.userId ?? undefined,
  });

  return {
    ok: true,
    message: "A 6-digit verification code has been sent to your email.",
  };
}

// ---- OTP Verification --------------------------------------------------------

export async function verifyOtpCode(params: {
  email: string;
  otp: string;
  purpose: OtpPurpose;
}): Promise<{ ok: boolean; verifiedToken: string; message: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanOtp = params.otp.trim().replace(/\D/g, "");
  const purpose = params.purpose;

  if (!cleanOtp || cleanOtp.length !== OTP_CONFIG.length) {
    throw new AuthError(`Please enter a valid ${OTP_CONFIG.length}-digit verification code.`, 400);
  }

  // 1. Fetch latest active OTP record for this email and purpose
  const record = get<AuthEmailOtpRecord>(
    `SELECT * FROM auth_email_otps
      WHERE lower(email) = lower(?)
        AND purpose = ?
      ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail, purpose],
  );

  if (!record) {
    throw new AuthError("No verification request found for this email. Please request a new code.", 400);
  }

  if (record.consumed_at) {
    throw new AuthError("This verification code has already been used. Please request a new one.", 401);
  }

  const now = new Date();
  if (now > new Date(record.expires_at)) {
    throw new AuthError("This verification code has expired. Please request a new one.", 401);
  }

  if (record.attempts >= record.max_attempts) {
    throw new AuthError(
      "Maximum verification attempts exceeded. Please request a new verification code.",
      429,
    );
  }

  // 2. Increment attempt count
  run("UPDATE auth_email_otps SET attempts = attempts + 1 WHERE id = ?", [record.id]);
  if (purpose === "password_reset") {
    run("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?", [record.id]);
  }

  // 3. Verify hash
  const isValid = verifyPassword(cleanOtp, { hash: record.otp_hash, salt: record.otp_salt });

  if (!isValid) {
    const remainingAttempts = Math.max(0, record.max_attempts - (record.attempts + 1));
    if (remainingAttempts === 0) {
      throw new AuthError("Maximum verification attempts exceeded. Please request a new code.", 429);
    }
    throw new AuthError(
      `Invalid verification code. You have ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
      401,
    );
  }

  // 4. Mark as verified and consumed
  const verifiedToken = `tok-${randomToken()}`;
  tx(() => {
    run(
      "UPDATE auth_email_otps SET verified_at = ?, consumed_at = ? WHERE id = ?",
      [now.toISOString(), now.toISOString(), record.id],
    );
    if (purpose === "password_reset") {
      run("UPDATE password_reset_otps SET used_at = ? WHERE id = ?", [now.toISOString(), record.id]);
    }
  });

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      await admin
        .from("auth_email_otps")
        .update({ verified_at: now.toISOString(), consumed_at: now.toISOString() })
        .eq("id", record.id);
    } catch {
      // Ignore
    }
  }

  return {
    ok: true,
    verifiedToken,
    message: "Verification code verified successfully.",
  };
}

// ---- Legacy Compatibility Wrappers ------------------------------------------

/**
 * Creates and dispatches a password recovery OTP.
 * Retains exact signature for existing routes/services.
 */
export async function createPasswordResetOtp(
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();

  // Anti-enumeration check
  let userExists = false;
  let userName = cleanEmail.split("@")[0];

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("id, full_name")
        .eq("email", cleanEmail)
        .single();
      if (profile) {
        userExists = true;
        userName = profile.full_name || userName;
      }
    } catch {
      // Ignore
    }
  }

  if (!userExists) {
    const localUser = get<{ id: string; name: string }>(
      "SELECT id, name FROM app_users WHERE lower(email) = lower(?)",
      [cleanEmail],
    );
    if (localUser) {
      userExists = true;
      userName = localUser.name || userName;
    }
  }

  // Anti-enumeration: If user doesn't exist, return generic success without dispatching email
  if (!userExists) {
    return {
      ok: true,
      message: "If an account matches this email, password reset instructions and a verification code have been sent.",
    };
  }

  await createAndSendOtp({
    email: cleanEmail,
    purpose: "password_reset",
    recipientName: userName,
  });

  return {
    ok: true,
    message: "If an account matches this email, password reset instructions and a verification code have been sent.",
  };
}

/**
 * Verifies a password reset OTP.
 * Retains exact signature for existing routes/services.
 */
export async function verifyPasswordResetOtp(
  email: string,
  otp: string,
): Promise<{ ok: boolean; recoveryToken: string; message: string }> {
  const result = await verifyOtpCode({
    email,
    otp,
    purpose: "password_reset",
  });

  // Create recovery session in sessions table (valid for 15 minutes)
  const cleanEmail = email.trim().toLowerCase();
  const recoveryToken = result.verifiedToken;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  const user = get<{ id: string }>(
    "SELECT id FROM app_users WHERE lower(email) = lower(?)",
    [cleanEmail],
  );
  if (user) {
    run("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [
      recoveryToken,
      user.id,
      now.toISOString(),
      expiresAt.toISOString(),
    ]);
  }

  return {
    ok: true,
    recoveryToken,
    message: result.message,
  };
}
