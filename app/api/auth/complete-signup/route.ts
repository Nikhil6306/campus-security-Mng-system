import { NextResponse } from "next/server";

import { AuthError } from "@/lib/server/auth";
import { bootstrap, readBody } from "@/lib/server/http";
import { verifyOtpCode } from "@/lib/server/services/otp";
import { sendWelcomeEmail } from "@/lib/email/email-service";
import { logSecurityEvent } from "@/lib/server/services/security-audit";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { get, run } from "@/lib/server/db";
import { completeSignupSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Completes signup verification using 6-digit OTP.
 * Activates account in Supabase/app_users and dispatches welcome email.
 */
export async function POST(request: Request) {
  try {
    bootstrap();
    const input = parse(completeSignupSchema, await readBody(request));
    const cleanEmail = input.email.trim().toLowerCase();

    // 1. Verify signup OTP
    await verifyOtpCode({
      email: cleanEmail,
      otp: input.otp,
      purpose: "signup_verification",
    });

    const now = new Date().toISOString();
    let userId: string | null = null;
    let roleName = "Visitor";
    let userName = cleanEmail.split("@")[0];

    // 2. Activate in Supabase
    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdminClient();
        const { data: profile } = await admin
          .from("profiles")
          .select("id, full_name, role")
          .eq("email", cleanEmail)
          .single();

        if (profile) {
          userId = profile.id;
          userName = profile.full_name || userName;
          roleName = profile.role || roleName;

          await admin
            .from("profiles")
            .update({ active: true, updated_at: now })
            .eq("id", profile.id);
        }
      } catch {
        // Ignore
      }
    }

    // 3. Activate in SQLite
    const localUser = get<{ id: string; name: string; role: string }>(
      "SELECT id, name, role FROM app_users WHERE lower(email) = lower(?)",
      [cleanEmail],
    );
    if (localUser) {
      userId = userId ?? localUser.id;
      userName = localUser.name || userName;
      roleName = localUser.role || roleName;
      run("UPDATE app_users SET active = 1, updated_at = ? WHERE id = ?", [now, localUser.id]);
    }

    // 4. Log security event
    await logSecurityEvent({
      userId,
      eventType: "account_verified",
      description: `Account email ${cleanEmail} verified via OTP and activated.`,
    });

    // 5. Send welcome email via EmailJS
    void sendWelcomeEmail({
      toEmail: cleanEmail,
      toName: userName,
      role: roleName,
      userId: userId ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      message: "Account verified successfully. You may now sign in.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: { message: error.message, code: "auth_error" } },
        { status: error.status },
      );
    }
    const status = (error as { status?: number }).status ?? 400;
    const message =
      (error as { message?: string }).message ?? "Could not complete verification.";
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request" } },
      { status },
    );
  }
}
