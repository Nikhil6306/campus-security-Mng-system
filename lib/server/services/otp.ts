import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { get, run, tx } from "../db";
import { hashPassword, randomToken, verifyPassword } from "../password";
import { AuthError } from "../auth";
import { getSupabaseAdminClient, getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { sendCampusEmail } from "./email";
import { getAppOrigin } from "../app-origin";

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFICATION_ATTEMPTS = 5;

function recoverySigningSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.JWT_ACCESS_SECRET?.trim() ||
    "csms-local-recovery-secret"
  );
}

export function signRecoveryToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email: email.trim().toLowerCase(), exp: Date.now() + 15 * 60_000, jti: randomToken(12) }),
  ).toString("base64url");
  const sig = createHmac("sha256", recoverySigningSecret()).update(payload).digest("base64url");
  return `rec.${payload}.${sig}`;
}

export function verifyRecoveryToken(token: string): { email: string } | null {
  if (!token || !token.startsWith("rec.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [, payload, sig] = parts;
  const expectedSig = createHmac("sha256", recoverySigningSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; exp?: number };
    if (!parsed.email || !parsed.exp || Date.now() > parsed.exp) return null;
    return { email: parsed.email.toLowerCase() };
  } catch {
    return null;
  }
}

export interface OtpRecord {
  id: string;
  email: string;
  otp_hash: string;
  salt: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

/**
 * Creates and dispatches a password recovery OTP.
 * Enforces a 60-second cooldown and never exposes the plaintext OTP to client code or API responses.
 */
export async function createPasswordResetOtp(
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Enforce Resend Cooldown (60 seconds) across SQLite & Supabase
  let recent = get<OtpRecord>(
    `SELECT * FROM password_reset_otps
      WHERE lower(email) = lower(?)
        AND used_at IS NULL
        AND datetime(created_at, '+${RESEND_COOLDOWN_SECONDS} seconds') > datetime('now')
      ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail],
  );

  if (!recent && isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      const cutoff = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000).toISOString();
      const { data: sbRecent } = await admin
        .from("password_reset_otps")
        .select("*")
        .ilike("email", cleanEmail)
        .is("used_at", null)
        .gt("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sbRecent) recent = sbRecent as OtpRecord;
    } catch {
      // Ignore
    }
  }

  if (recent) {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(recent.created_at).getTime()) / 1000),
    );
    const waitSeconds = Math.max(1, RESEND_COOLDOWN_SECONDS - elapsedSeconds);
    throw new AuthError(
      `Please wait ${waitSeconds} seconds before requesting another verification code.`,
      429,
    );
  }

  // 2. Check if user exists (Supabase or SQLite)
  let userExists = false;
  let rawOtp: string | null = null;
  let actionLink: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      const { data: prof } = await admin
        .from("profiles")
        .select("id, active")
        .ilike("email", cleanEmail)
        .maybeSingle();

      // Do not allow inactive / pending / rejected guard accounts to reset password
      if (prof && !prof.active) {
        return {
          ok: true,
          message: "If an account matches this email, password reset instructions and a verification code have been sent.",
        };
      }

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: cleanEmail,
      });

      if (!linkErr && linkData?.properties) {
        userExists = true;
        rawOtp = linkData.properties.email_otp || null;
        actionLink = linkData.properties.action_link || null;
      }
    } catch {
      // In case of network error or missing user
    }
  }

  if (!userExists) {
    const localUser = get<{ id: string }>(
      "SELECT id FROM app_users WHERE lower(email) = lower(?)",
      [cleanEmail],
    );
    if (localUser) {
      userExists = true;
    }
  }

  // Anti-enumeration: If user does not exist, return a generic success message
  if (!userExists) {
    return {
      ok: true,
      message: "If an account matches this email, password reset instructions and a verification code have been sent.",
    };
  }

  // Generate fallback OTP if Supabase did not return one
  if (!rawOtp) {
    rawOtp = randomInt(100000, 999999).toString();
  }

  // 3. Hash OTP before storing (never plaintext)
  const { hash: otpHash, salt } = hashPassword(rawOtp);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const id = `otp-${randomToken().slice(0, 16)}`;

  tx(() => {
    // Invalidate previous unverified OTPs for this email
    run(
      "UPDATE password_reset_otps SET used_at = ? WHERE lower(email) = lower(?) AND used_at IS NULL",
      [now.toISOString(), cleanEmail],
    );

    run(
      `INSERT INTO password_reset_otps (id, email, otp_hash, salt, attempts, max_attempts, created_at, expires_at, used_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL)`,
      [id, cleanEmail, otpHash, salt, MAX_VERIFICATION_ATTEMPTS, now.toISOString(), expiresAt.toISOString()],
    );
  });

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      await admin
        .from("password_reset_otps")
        .update({ used_at: now.toISOString() })
        .ilike("email", cleanEmail)
        .is("used_at", null);

      await admin.from("password_reset_otps").insert({
        id,
        email: cleanEmail,
        otp_hash: otpHash,
        salt,
        attempts: 0,
        max_attempts: MAX_VERIFICATION_ATTEMPTS,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        used_at: null,
      });
    } catch (sbOtpErr) {
      console.warn("[otp] Supabase OTP persist warning:", sbOtpErr);
    }
  }

  // 4. Dispatch Email if email service is configured
  const resetUrl = actionLink || `${getAppOrigin()}/reset-password?email=${encodeURIComponent(cleanEmail)}`;
  try {
    if (process.env.RESEND_API_KEY) {
      await sendCampusEmail({
        to: cleanEmail,
        subject: "DSVV Campus Security — Password Reset Verification Code",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f172a; margin-top: 0;">Password Reset Request</h2>
            <p style="color: #475569; font-size: 15px;">You requested a password reset for your Campus Security Management System account at Dev Sanskriti Vishwavidyalaya.</p>
            <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 18px; text-align: center; margin: 24px 0;">
              <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px;">Your One-Time Verification Code</span>
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7; font-family: monospace;">${rawOtp}</span>
              <span style="font-size: 12px; color: #94a3b8; display: block; margin-top: 6px;">Valid for 5 minutes · Single use only</span>
            </div>
            <p style="color: #475569; font-size: 14px;">Alternatively, click the link below to reset your password directly:</p>
            <p><a href="${resetUrl}" style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Password</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">If you did not request this password reset, please ignore this email or contact Campus Security immediately.</p>
          </div>
        `,
        text: `Your Campus Security password reset verification code is: ${rawOtp}\n\nValid for 5 minutes. Alternatively, reset using this link: ${resetUrl}`,
      });
    }
  } catch (emailErr) {
    console.warn("[otp] Email dispatch warning:", emailErr);
  }

  return {
    ok: true,
    message: "If an account matches this email, password reset instructions and a verification code have been sent.",
  };
}

/**
 * Verifies a submitted OTP code.
 * Rejects expired codes, enforces maximum 5 attempts, prevents reuse, and returns a temporary recovery session token.
 */
export async function verifyPasswordResetOtp(
  email: string,
  otp: string,
): Promise<{ ok: boolean; recoveryToken: string; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim().replace(/\D/g, "");

  if (!cleanOtp) {
    throw new AuthError("Please enter a valid verification code.", 400);
  }

  // 1. Fetch latest active OTP record (SQLite + Supabase fallback for stateless serverless)
  let record = get<OtpRecord>(
    `SELECT * FROM password_reset_otps
      WHERE lower(email) = lower(?)
      ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail],
  );

  if (!record && isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      const { data: sbOtp } = await admin
        .from("password_reset_otps")
        .select("*")
        .ilike("email", cleanEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sbOtp) {
        record = sbOtp as OtpRecord;
      }
    } catch {
      // Ignore Supabase read error
    }
  }

  if (!record) {
    throw new AuthError("No verification request found for this email. Please request a new code.", 400);
  }

  if (record.used_at) {
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
  run("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?", [record.id]);
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      await admin
        .from("password_reset_otps")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);
    } catch {
      // Ignore
    }
  }

  // 3. Verify OTP code
  let isValid = false;
  let supabaseAccessToken: string | null = null;

  // Check Supabase Auth verifyOtp if configured
  if (isSupabaseConfigured()) {
    try {
      const anonClient = getSupabaseServerClient();
      const { data, error } = await anonClient.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: "recovery",
      });

      if (!error && data?.session?.access_token) {
        isValid = true;
        supabaseAccessToken = data.session.access_token;
      }
    } catch {
      // Fall through to hash verification
    }
  }

  // Fallback / check against stored hash
  if (!isValid) {
    isValid = verifyPassword(cleanOtp, { hash: record.otp_hash, salt: record.salt });
  }

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

  // 4. Mark OTP as used (prevents replay/reuse)
  run("UPDATE password_reset_otps SET used_at = ? WHERE id = ?", [now.toISOString(), record.id]);
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      await admin
        .from("password_reset_otps")
        .update({ used_at: now.toISOString() })
        .eq("id", record.id);
    } catch {
      // Ignore
    }
  }

  // 5. Issue recovery token
  // Use Supabase access token if available, otherwise issue a signed stateless recovery token
  // (plus local SQLite session for offline unit tests)
  let recoveryToken = supabaseAccessToken;
  if (!recoveryToken) {
    recoveryToken = signRecoveryToken(cleanEmail);
    const user = get<{ id: string }>("SELECT id FROM app_users WHERE lower(email) = lower(?)", [cleanEmail]);
    if (user) {
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins
      run("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [
        recoveryToken,
        user.id,
        now.toISOString(),
        expiresAt.toISOString(),
      ]);
    }
  }

  return {
    ok: true,
    recoveryToken,
    message: "Verification code verified successfully. You may now enter your new password.",
  };
}
