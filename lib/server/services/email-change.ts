/**
 * Two-step Email Change Service for DSVV Campus Security Management System.
 *
 * Implements:
 * 1. Request: Validates new email is not taken, creates pending_email_changes record,
 *    and sends OTP to the OLD registered email.
 * 2. Verify Old: Verifies OTP sent to old email, marks old_email_verified_at,
 *    and sends OTP to the NEW email address.
 * 3. Verify New: Verifies OTP sent to new email, updates email in Supabase Auth & profiles,
 *    updates application records, logs security event, and sends confirmation to both emails.
 */

import "server-only";

import { get, run, tx } from "../db";
import { AuthError } from "../auth";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { createAndSendOtp, verifyOtpCode } from "./otp";
import { sendNotificationEmail } from "@/lib/email/email-service";
import { logSecurityEvent } from "./security-audit";
import { OTP_CONFIG } from "@/lib/email/email-config";

export interface PendingEmailChangeRecord {
  id: string;
  user_id: string;
  old_email: string;
  new_email: string;
  old_email_verified_at: string | null;
  new_email_verified_at: string | null;
  status: "pending" | "old_verified" | "new_verified" | "completed" | "expired" | "cancelled";
  expires_at: string;
  created_at: string;
  completed_at: string | null;
}

// ---- Step 1: Request Email Change -------------------------------------------

export async function requestEmailChange(params: {
  userId: string;
  currentEmail: string;
  newEmail: string;
  userName?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const cleanOld = params.currentEmail.trim().toLowerCase();
  const cleanNew = params.newEmail.trim().toLowerCase();

  if (cleanOld === cleanNew) {
    throw new AuthError("New email address must be different from your current email.", 400);
  }

  // Validate format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNew)) {
    throw new AuthError("Please provide a valid new email address.", 400);
  }

  // Check if new email is already registered
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", cleanNew)
        .single();

      if (existingProfile) {
        throw new AuthError("An account with this email address already exists.", 400);
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
    }
  }

  const existingLocal = get<{ id: string }>(
    "SELECT id FROM app_users WHERE lower(email) = lower(?) AND id != ?",
    [cleanNew, params.userId],
  );
  if (existingLocal) {
    throw new AuthError("An account with this email address already exists.", 400);
  }

  const id = `emc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins window

  // Invalidate any existing active pending change for this user
  tx(() => {
    run(
      `UPDATE pending_email_changes
          SET status = 'cancelled'
        WHERE user_id = ? AND status IN ('pending', 'old_verified')`,
      [params.userId],
    );

    run(
      `INSERT INTO pending_email_changes (
        id, user_id, old_email, new_email, old_email_verified_at,
        new_email_verified_at, status, expires_at, created_at, completed_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, 'pending', ?, ?, NULL)`,
      [id, params.userId, cleanOld, cleanNew, expiresAt.toISOString(), now.toISOString()],
    );
  });

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      await admin
        .from("pending_email_changes")
        .update({ status: "cancelled" })
        .eq("user_id", params.userId)
        .in("status", ["pending", "old_verified"]);

      await admin.from("pending_email_changes").insert({
        id,
        user_id: params.userId,
        old_email: cleanOld,
        new_email: cleanNew,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
      });
    } catch (sbErr) {
      console.warn("[email-change] Supabase pending_email_changes warning:", (sbErr as Error).message);
    }
  }

  // Send OTP ONLY to the OLD email address
  await createAndSendOtp({
    email: cleanOld,
    purpose: "email_change_old",
    userId: params.userId,
    recipientName: params.userName ?? cleanOld.split("@")[0],
  });

  await logSecurityEvent({
    userId: params.userId,
    eventType: "email_change_requested",
    description: `Email change requested from ${cleanOld} to ${cleanNew}. Verification sent to current email.`,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: { oldEmail: cleanOld, newEmail: cleanNew },
  });

  return {
    ok: true,
    message: `A verification code has been sent to your current registered email (${cleanOld}).`,
  };
}

// ---- Step 2: Verify Old Email OTP -------------------------------------------

export async function verifyOldEmailOtp(params: {
  userId: string;
  otp: string;
  userName?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ ok: boolean; message: string; newEmail: string }> {
  // Find active pending request
  const pending = get<PendingEmailChangeRecord>(
    `SELECT * FROM pending_email_changes
      WHERE user_id = ? AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1`,
    [params.userId],
  );

  if (!pending) {
    throw new AuthError("No active email change request found. Please start a new request.", 400);
  }

  if (new Date() > new Date(pending.expires_at)) {
    run("UPDATE pending_email_changes SET status = 'expired' WHERE id = ?", [pending.id]);
    throw new AuthError("Your email change request has expired. Please start over.", 401);
  }

  // Verify OTP for old email
  await verifyOtpCode({
    email: pending.old_email,
    otp: params.otp,
    purpose: "email_change_old",
  });

  const now = new Date().toISOString();

  // Mark old email verified
  run(
    "UPDATE pending_email_changes SET old_email_verified_at = ?, status = 'old_verified' WHERE id = ?",
    [now, pending.id],
  );

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      await admin
        .from("pending_email_changes")
        .update({ old_email_verified_at: now, status: "old_verified" })
        .eq("id", pending.id);
    } catch {
      // Ignore
    }
  }

  // Now send OTP to the NEW email address
  await createAndSendOtp({
    email: pending.new_email,
    purpose: "email_change_new",
    userId: params.userId,
    recipientName: params.userName ?? pending.new_email.split("@")[0],
  });

  await logSecurityEvent({
    userId: params.userId,
    eventType: "email_change_old_verified",
    description: `Current email (${pending.old_email}) verified for email change. Verification sent to ${pending.new_email}.`,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: { oldEmail: pending.old_email, newEmail: pending.new_email },
  });

  return {
    ok: true,
    message: `Current email verified. A confirmation code has now been sent to your new email (${pending.new_email}).`,
    newEmail: pending.new_email,
  };
}

// ---- Step 3: Verify New Email OTP & Complete Change -------------------------

export async function verifyNewEmailOtpAndComplete(params: {
  userId: string;
  otp: string;
  userName?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ ok: boolean; message: string; updatedEmail: string }> {
  // Find pending request in 'old_verified' state
  const pending = get<PendingEmailChangeRecord>(
    `SELECT * FROM pending_email_changes
      WHERE user_id = ? AND status = 'old_verified'
      ORDER BY created_at DESC LIMIT 1`,
    [params.userId],
  );

  if (!pending) {
    throw new AuthError(
      "No verified email change request found. Please verify your current email first.",
      400,
    );
  }

  if (new Date() > new Date(pending.expires_at)) {
    run("UPDATE pending_email_changes SET status = 'expired' WHERE id = ?", [pending.id]);
    throw new AuthError("Your email change request has expired. Please start over.", 401);
  }

  // Verify OTP for new email
  await verifyOtpCode({
    email: pending.new_email,
    otp: params.otp,
    purpose: "email_change_new",
  });

  const now = new Date().toISOString();
  const oldEmail = pending.old_email;
  const newEmail = pending.new_email;

  // 1. Update Supabase Auth user email and profile
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      // Update Supabase Auth auth.users
      const { error: authErr } = await admin.auth.admin.updateUserById(params.userId, {
        email: newEmail,
        email_confirm: true,
      });

      if (authErr) {
        throw new AuthError(`Failed to update email in authentication service: ${authErr.message}`, 400);
      }

      // Update public.profiles
      const { error: profileErr } = await admin
        .from("profiles")
        .update({ email: newEmail, updated_at: now })
        .eq("id", params.userId);

      if (profileErr) {
        console.warn("[email-change] Supabase profiles update warning:", profileErr.message);
      }
    } catch (sbErr) {
      if (sbErr instanceof AuthError) throw sbErr;
      console.warn("[email-change] Supabase auth update warning:", (sbErr as Error).message);
    }
  }

  // 2. Update local SQLite tables
  tx(() => {
    run(
      "UPDATE pending_email_changes SET new_email_verified_at = ?, status = 'completed', completed_at = ? WHERE id = ?",
      [now, now, pending.id],
    );

    run("UPDATE app_users SET email = ?, updated_at = ? WHERE id = ?", [
      newEmail,
      now,
      params.userId,
    ]);

    // Sync other relevant tables if referenced
    run("UPDATE security_guards SET email = ?, updated_at = ? WHERE email = ?", [
      newEmail,
      now,
      oldEmail,
    ]);
    run("UPDATE teachers SET email = ?, updated_at = ? WHERE email = ?", [
      newEmail,
      now,
      oldEmail,
    ]);
    run("UPDATE visitors SET email = ?, updated_at = ? WHERE email = ?", [
      newEmail,
      now,
      oldEmail,
    ]);
  });

  // 3. Log security event
  await logSecurityEvent({
    userId: params.userId,
    eventType: "email_change_completed",
    description: `Email address successfully changed from ${oldEmail} to ${newEmail}.`,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: { oldEmail, newEmail },
  });

  // 4. Send email notifications to BOTH old and new emails
  const name = params.userName ?? newEmail.split("@")[0];
  const desc = `Your Campus Security account email address was changed from ${oldEmail} to ${newEmail} on ${new Date().toLocaleDateString("en-IN")}. If you did not make this change, contact Campus Security immediately.`;

  void sendNotificationEmail({
    toEmail: oldEmail,
    toName: name,
    eventType: "Account Email Address Changed",
    eventDescription: desc,
    userId: params.userId,
    subject: "DSVV Campus Security — Your Account Email Was Changed",
  });

  void sendNotificationEmail({
    toEmail: newEmail,
    toName: name,
    eventType: "Email Address Confirmed",
    eventDescription: `Your new email address has been verified and set as your primary sign-in email for ${newEmail}.`,
    userId: params.userId,
    subject: "DSVV Campus Security — Email Address Successfully Updated",
  });

  return {
    ok: true,
    message: "Email address changed successfully. Notifications have been sent to both addresses.",
    updatedEmail: newEmail,
  };
}
