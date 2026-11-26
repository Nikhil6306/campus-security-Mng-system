/**
 * Centralized EmailJS email service for the DSVV Campus Security Management System.
 *
 * Uses the EmailJS REST API (server-side) with private key authentication.
 * Never exposes EMAILJS_PRIVATE_KEY to the browser.
 *
 * Falls back to the existing Resend email service if EmailJS is not configured.
 */

import "server-only";

import { EMAIL_CONFIG, isEmailJsConfigured } from "./email-config";
import { type OtpPurpose } from "./email-templates";
import {
  buildOtpTemplateVars,
  buildNotificationTemplateVars,
  buildWelcomeTemplateVars,
  buildSecurityAlertTemplateVars,
  buildOtpHtmlFallback,
  toISTString,
} from "./email-templates";

// ---- Types ------------------------------------------------------------------

export interface EmailJsResponse {
  status: number;
  text: string;
}

export interface SendEmailResult {
  ok: boolean;
  provider: "emailjs" | "resend" | "simulated";
  providerResponse?: unknown;
  errorMessage?: string;
}

// ---- Core EmailJS sender ----------------------------------------------------

const EMAILJS_API_URL = "https://api.emailjs.com/api/v1.0/email/send";

/**
 * Sends an email via the EmailJS REST API using server-side private key auth.
 * This must only be called from server-side code.
 */
async function sendViaEmailJs(
  templateId: string,
  templateParams: Record<string, string>,
): Promise<EmailJsResponse> {
  if (!EMAIL_CONFIG.serviceId) {
    throw new Error("EMAILJS_SERVICE_ID is not configured.");
  }
  if (!EMAIL_CONFIG.privateKey) {
    throw new Error("EMAILJS_PRIVATE_KEY is not configured.");
  }
  if (!templateId) {
    throw new Error("EmailJS template ID is not configured.");
  }

  const payload = {
    service_id: EMAIL_CONFIG.serviceId,
    template_id: templateId,
    user_id: EMAIL_CONFIG.publicKey || EMAIL_CONFIG.privateKey,
    accessToken: EMAIL_CONFIG.privateKey,
    template_params: templateParams,
  };

  const response = await fetch(EMAILJS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: EMAIL_CONFIG.appUrl,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `EmailJS API error (HTTP ${response.status}): ${text}`,
    );
  }

  return { status: response.status, text };
}

// ---- Resend fallback --------------------------------------------------------

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) return false;

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.RESEND_ENABLE_DEVELOPMENT_DELIVERY !== "true"
  ) {
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Persistence helper (logs delivery to Supabase) -------------------------

async function logEmailDelivery(params: {
  userId?: string;
  recipientEmail: string;
  eventType: string;
  subject: string;
  status: "sent" | "failed" | "simulated";
  provider: "emailjs" | "resend" | "simulated";
  providerResponse?: unknown;
  errorMessage?: string;
}): Promise<void> {
  try {
    const { getSupabaseAdminClient, isSupabaseConfigured } = await import(
      "@/lib/supabase"
    );
    if (!isSupabaseConfigured()) return;

    const admin = getSupabaseAdminClient();
    await admin.from("email_notifications").insert({
      user_id: params.userId ?? null,
      recipient_email: params.recipientEmail,
      event_type: params.eventType,
      subject: params.subject,
      delivery_status: params.status,
      provider: params.provider,
      provider_response: params.providerResponse
        ? JSON.parse(JSON.stringify(params.providerResponse))
        : null,
      error_message: params.errorMessage ?? null,
      sent_at: params.status === "sent" ? new Date().toISOString() : null,
    });
  } catch (err) {
    // Non-fatal — never block email sending on logging failure
    console.warn("[email-service] Failed to log email delivery:", err);
  }
}

// ---- Public API -------------------------------------------------------------

/**
 * Sends an OTP email to a user for the given purpose.
 * Tries EmailJS first, falls back to Resend, then simulates in dev mode.
 */
export async function sendOtpEmail(params: {
  toEmail: string;
  toName: string;
  otp: string;
  purpose: OtpPurpose;
  userId?: string;
}): Promise<SendEmailResult> {
  const { OTP_CONFIG } = await import("./email-config");
  const templateVars = buildOtpTemplateVars({
    toEmail: params.toEmail,
    toName: params.toName,
    otp: params.otp,
    purpose: params.purpose,
    expiryMinutes: OTP_CONFIG.expiryMinutes,
  });

  const purposeLabels: Record<OtpPurpose, string> = {
    signup_verification: "Account Verification Code",
    password_reset: "Password Reset Code",
    email_change_old: "Email Change Verification",
    email_change_new: "New Email Verification",
    login_verification: "Login Verification Code",
  };

  const subject = `DSVV Campus Security — ${purposeLabels[params.purpose]}`;

  // 1. Try EmailJS
  if (isEmailJsConfigured()) {
    try {
      const response = await sendViaEmailJs(
        EMAIL_CONFIG.templates.otp,
        templateVars,
      );
      await logEmailDelivery({
        userId: params.userId,
        recipientEmail: params.toEmail,
        eventType: `otp_${params.purpose}`,
        subject,
        status: "sent",
        provider: "emailjs",
        providerResponse: response,
      });
      return { ok: true, provider: "emailjs", providerResponse: response };
    } catch (err) {
      console.warn("[email-service] EmailJS OTP send failed:", (err as Error).message);
      // Fall through to Resend
    }
  }

  // 2. Try Resend fallback
  const html = buildOtpHtmlFallback({
    toName: params.toName,
    otp: params.otp,
    purpose: params.purpose,
    expiryMinutes: OTP_CONFIG.expiryMinutes,
  });

  const resendOk = await sendViaResend({
    to: params.toEmail,
    subject,
    html,
    text: `Your ${purposeLabels[params.purpose]} for ${EMAIL_CONFIG.appName} is: ${params.otp}\n\nValid for ${OTP_CONFIG.expiryMinutes} minutes. Do not share this code.`,
  });

  if (resendOk) {
    await logEmailDelivery({
      userId: params.userId,
      recipientEmail: params.toEmail,
      eventType: `otp_${params.purpose}`,
      subject,
      status: "sent",
      provider: "resend",
    });
    return { ok: true, provider: "resend" };
  }

  // 3. Simulate in development
  console.info(
    `[email-service] SIMULATED OTP email to ${params.toEmail} | Purpose: ${params.purpose} | OTP: [REDACTED - check server logs only in dev] | Note: Configure EMAILJS or RESEND for real delivery.`,
  );
  if (process.env.NODE_ENV !== "production") {
    console.info(`[email-service] DEV OTP: ${params.otp}`);
  }

  await logEmailDelivery({
    userId: params.userId,
    recipientEmail: params.toEmail,
    eventType: `otp_${params.purpose}`,
    subject,
    status: "simulated",
    provider: "simulated",
  });

  return { ok: true, provider: "simulated" };
}

/**
 * Sends a notification email (login, password change, account changes, etc.)
 */
export async function sendNotificationEmail(params: {
  toEmail: string;
  toName: string;
  eventType: string;
  eventDescription: string;
  eventTime?: Date;
  role?: string;
  userId?: string;
  subject?: string;
}): Promise<SendEmailResult> {
  const { SECURITY_CONFIG } = await import("./email-config");
  if (!SECURITY_CONFIG.emailNotificationsEnabled) {
    return { ok: true, provider: "simulated" };
  }

  const templateVars = buildNotificationTemplateVars({
    toEmail: params.toEmail,
    toName: params.toName,
    eventType: params.eventType,
    eventDescription: params.eventDescription,
    eventTime: params.eventTime,
    role: params.role,
  });

  const subject =
    params.subject ??
    `DSVV Campus Security — ${params.eventType}`;

  // 1. Try EmailJS
  if (isEmailJsConfigured() && EMAIL_CONFIG.templates.notification) {
    try {
      const response = await sendViaEmailJs(
        EMAIL_CONFIG.templates.notification,
        templateVars,
      );
      await logEmailDelivery({
        userId: params.userId,
        recipientEmail: params.toEmail,
        eventType: params.eventType,
        subject,
        status: "sent",
        provider: "emailjs",
        providerResponse: response,
      });
      return { ok: true, provider: "emailjs", providerResponse: response };
    } catch (err) {
      console.warn("[email-service] EmailJS notification failed:", (err as Error).message);
    }
  }

  // 2. Resend fallback with inline HTML
  const html = buildNotificationHtmlFallback({
    toName: params.toName,
    eventType: params.eventType,
    eventDescription: params.eventDescription,
    eventTime: params.eventTime,
    role: params.role,
  });

  const resendOk = await sendViaResend({ to: params.toEmail, subject, html });
  if (resendOk) {
    await logEmailDelivery({
      userId: params.userId,
      recipientEmail: params.toEmail,
      eventType: params.eventType,
      subject,
      status: "sent",
      provider: "resend",
    });
    return { ok: true, provider: "resend" };
  }

  // 3. Dev simulation
  console.info(`[email-service] SIMULATED notification to ${params.toEmail} | ${params.eventType}`);
  await logEmailDelivery({
    userId: params.userId,
    recipientEmail: params.toEmail,
    eventType: params.eventType,
    subject,
    status: "simulated",
    provider: "simulated",
  });
  return { ok: true, provider: "simulated" };
}

/**
 * Sends a welcome email after successful registration/activation.
 */
export async function sendWelcomeEmail(params: {
  toEmail: string;
  toName: string;
  role: string;
  loginUrl?: string;
  userId?: string;
}): Promise<SendEmailResult> {
  const templateVars = buildWelcomeTemplateVars(params);
  const subject = `Welcome to DSVV Campus Security — ${params.role}`;

  if (isEmailJsConfigured() && EMAIL_CONFIG.templates.welcome) {
    try {
      const response = await sendViaEmailJs(EMAIL_CONFIG.templates.welcome, templateVars);
      await logEmailDelivery({
        userId: params.userId,
        recipientEmail: params.toEmail,
        eventType: "account_welcome",
        subject,
        status: "sent",
        provider: "emailjs",
        providerResponse: response,
      });
      return { ok: true, provider: "emailjs" };
    } catch (err) {
      console.warn("[email-service] EmailJS welcome email failed:", (err as Error).message);
    }
  }

  // Resend fallback
  const html = buildWelcomeHtmlFallback(params);
  const resendOk = await sendViaResend({ to: params.toEmail, subject, html });
  const status = resendOk ? "sent" : "simulated";
  const provider = resendOk ? "resend" : ("simulated" as const);
  await logEmailDelivery({ userId: params.userId, recipientEmail: params.toEmail, eventType: "account_welcome", subject, status, provider });
  return { ok: true, provider };
}

/**
 * Sends a security alert email (suspicious login, role change, etc.)
 */
export async function sendSecurityAlertEmail(params: {
  toEmail: string;
  toName: string;
  eventType: string;
  eventTime?: Date;
  deviceInfo?: string;
  userId?: string;
}): Promise<SendEmailResult> {
  const templateVars = buildSecurityAlertTemplateVars(params);
  const subject = `DSVV Campus Security — Security Alert: ${params.eventType}`;

  if (isEmailJsConfigured() && EMAIL_CONFIG.templates.securityAlert) {
    try {
      const response = await sendViaEmailJs(EMAIL_CONFIG.templates.securityAlert, templateVars);
      await logEmailDelivery({
        userId: params.userId,
        recipientEmail: params.toEmail,
        eventType: `security_alert_${params.eventType}`,
        subject,
        status: "sent",
        provider: "emailjs",
        providerResponse: response,
      });
      return { ok: true, provider: "emailjs" };
    } catch (err) {
      console.warn("[email-service] EmailJS security alert failed:", (err as Error).message);
    }
  }

  // Resend fallback
  const html = buildSecurityAlertHtmlFallback(params);
  const resendOk = await sendViaResend({ to: params.toEmail, subject, html });
  const status = resendOk ? "sent" : "simulated";
  const provider = resendOk ? "resend" : ("simulated" as const);
  await logEmailDelivery({ userId: params.userId, recipientEmail: params.toEmail, eventType: `security_alert_${params.eventType}`, subject, status, provider });
  return { ok: true, provider };
}

// ---- Inline HTML fallbacks (used when EmailJS is not configured) -------------

function buildNotificationHtmlFallback(params: {
  toName: string;
  eventType: string;
  eventDescription: string;
  eventTime?: Date;
  role?: string;
}): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f1f5f9;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#0A192F;padding:24px;text-align:center;border-bottom:3px solid #F59E0B;">
      <h1 style="color:#fff;font-size:18px;margin:0;">DSVV Campus Security</h1>
    </div>
    <div style="padding:24px;">
      <p style="font-size:15px;font-weight:600;">Hello ${params.toName},</p>
      <p style="font-size:14px;color:#475569;">${params.eventDescription}</p>
      <p style="font-size:13px;color:#94a3b8;">Time: ${toISTString(params.eventTime)}</p>
      ${params.role ? `<p style="font-size:13px;color:#94a3b8;">Role: ${params.role}</p>` : ""}
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      Dev Sanskriti Vishwavidyalaya &bull; Automated System Message
    </div>
  </div>
</body></html>`;
}

function buildWelcomeHtmlFallback(params: {
  toName: string;
  role: string;
  loginUrl?: string;
}): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f1f5f9;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#0A192F;padding:24px;text-align:center;border-bottom:3px solid #F59E0B;">
      <h1 style="color:#fff;font-size:18px;margin:0;">DSVV Campus Security</h1>
    </div>
    <div style="padding:24px;">
      <div style="display:inline-block;background:#dcfce7;color:#166534;padding:4px 12px;border-radius:9999px;font-size:13px;font-weight:700;margin-bottom:16px;">✓ Account Activated</div>
      <p style="font-size:15px;font-weight:600;">Welcome, ${params.toName}!</p>
      <p style="font-size:14px;color:#475569;">Your ${EMAIL_CONFIG.appName} account has been created with the role: <strong>${params.role}</strong>.</p>
      ${params.loginUrl ? `<p><a href="${params.loginUrl}" style="display:inline-block;background:#0284c7;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:500;">Sign In Now</a></p>` : ""}
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      Dev Sanskriti Vishwavidyalaya &bull; Automated System Message
    </div>
  </div>
</body></html>`;
}

function buildSecurityAlertHtmlFallback(params: {
  toName: string;
  eventType: string;
  eventTime?: Date;
  deviceInfo?: string;
}): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f1f5f9;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#0A192F;padding:24px;text-align:center;border-bottom:3px solid #EF4444;">
      <h1 style="color:#fff;font-size:18px;margin:0;">DSVV Campus Security — Security Alert</h1>
    </div>
    <div style="padding:24px;">
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="font-size:14px;font-weight:600;color:#991b1b;margin:0;">⚠️ Security Alert: ${params.eventType}</p>
      </div>
      <p style="font-size:14px;">Hello ${params.toName}, a security event occurred on your account.</p>
      <p style="font-size:13px;color:#64748b;">Time: ${toISTString(params.eventTime)}</p>
      ${params.deviceInfo ? `<p style="font-size:13px;color:#64748b;">Device: ${params.deviceInfo}</p>` : ""}
      <p style="font-size:13px;color:#ef4444;font-weight:500;">If this was not you, contact Campus Security immediately.</p>
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      Dev Sanskriti Vishwavidyalaya &bull; Automated System Message
    </div>
  </div>
</body></html>`;
}
