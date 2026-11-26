/**
 * EmailJS email templates for the DSVV Campus Security Management System.
 * All template functions return the variables object to pass to EmailJS REST API.
 *
 * EmailJS Template Variable Reference:
 *
 * OTP Template (EMAILJS_OTP_TEMPLATE_ID):
 *   {{to_email}}       - Recipient email address
 *   {{to_name}}        - Recipient display name
 *   {{otp}}            - 6-digit OTP code
 *   {{purpose_label}}  - Human-readable purpose (e.g. "Password Reset")
 *   {{expiry_minutes}} - OTP validity in minutes
 *   {{app_name}}       - Application name
 *   {{university_name}}- University name
 *   {{support_email}}  - Support email address
 *
 * Notification Template (EMAILJS_NOTIFICATION_TEMPLATE_ID):
 *   {{to_email}}           - Recipient email
 *   {{to_name}}            - Recipient name
 *   {{event_type}}         - Event type label
 *   {{event_description}}  - Full event description
 *   {{event_time}}         - Event date/time in IST
 *   {{role}}               - User's role label
 *   {{app_name}}           - Application name
 *
 * Welcome Template (EMAILJS_WELCOME_TEMPLATE_ID):
 *   {{to_email}}   - Recipient email
 *   {{to_name}}    - Recipient name
 *   {{role}}       - Assigned role label
 *   {{login_url}}  - Portal login URL
 *   {{app_name}}   - Application name
 *
 * Security Alert Template (EMAILJS_SECURITY_ALERT_TEMPLATE_ID):
 *   {{to_email}}    - Recipient email
 *   {{to_name}}     - Recipient name
 *   {{event_type}}  - Alert type
 *   {{event_time}}  - Date/time in IST
 *   {{device_info}} - Device/browser info (sanitized)
 *   {{app_name}}    - Application name
 */

import { EMAIL_CONFIG } from "./email-config";

const APP_NAME = EMAIL_CONFIG.appName;
const UNIVERSITY = "Dev Sanskriti Vishwavidyalaya";

/** Format a Date to IST string for email display */
export function toISTString(date: Date = new Date()): string {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) + " IST";
}

/** Mask email for safe display: a***@domain.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}

export type OtpPurpose =
  | "signup_verification"
  | "password_reset"
  | "email_change_old"
  | "email_change_new"
  | "login_verification";

const PURPOSE_LABELS: Record<OtpPurpose, string> = {
  signup_verification: "Account Verification",
  password_reset: "Password Reset",
  email_change_old: "Email Change Verification (Current Email)",
  email_change_new: "Email Change Verification (New Email)",
  login_verification: "Login Verification",
};

/** Variables for the OTP EmailJS template */
export function buildOtpTemplateVars(params: {
  toEmail: string;
  toName: string;
  otp: string;
  purpose: OtpPurpose;
  expiryMinutes: number;
}) {
  return {
    to_email: params.toEmail,
    to_name: params.toName,
    otp: params.otp,
    purpose_label: PURPOSE_LABELS[params.purpose],
    expiry_minutes: String(params.expiryMinutes),
    app_name: APP_NAME,
    university_name: UNIVERSITY,
    support_email: EMAIL_CONFIG.supportEmail,
    // Also provide a formatted HTML block for templates that embed it
    otp_html: `<div style="font-family:monospace;font-size:36px;font-weight:bold;letter-spacing:12px;color:#0284c7;text-align:center;padding:20px 0;">${params.otp}</div>`,
  };
}

/** Variables for the notification EmailJS template */
export function buildNotificationTemplateVars(params: {
  toEmail: string;
  toName: string;
  eventType: string;
  eventDescription: string;
  eventTime?: Date;
  role?: string;
}) {
  return {
    to_email: params.toEmail,
    to_name: params.toName,
    event_type: params.eventType,
    event_description: params.eventDescription,
    event_time: toISTString(params.eventTime),
    role: params.role ?? "User",
    app_name: APP_NAME,
    university_name: UNIVERSITY,
    support_email: EMAIL_CONFIG.supportEmail,
  };
}

/** Variables for the welcome EmailJS template */
export function buildWelcomeTemplateVars(params: {
  toEmail: string;
  toName: string;
  role: string;
  loginUrl?: string;
}) {
  return {
    to_email: params.toEmail,
    to_name: params.toName,
    role: params.role,
    login_url: params.loginUrl ?? EMAIL_CONFIG.appUrl,
    app_name: APP_NAME,
    university_name: UNIVERSITY,
    support_email: EMAIL_CONFIG.supportEmail,
  };
}

/** Variables for the security alert EmailJS template */
export function buildSecurityAlertTemplateVars(params: {
  toEmail: string;
  toName: string;
  eventType: string;
  eventTime?: Date;
  deviceInfo?: string;
}) {
  return {
    to_email: params.toEmail,
    to_name: params.toName,
    event_type: params.eventType,
    event_time: toISTString(params.eventTime),
    device_info: params.deviceInfo ?? "Unknown device",
    app_name: APP_NAME,
    university_name: UNIVERSITY,
    support_email: EMAIL_CONFIG.supportEmail,
  };
}

/** HTML email body when EmailJS is not configured (Resend fallback) */
export function buildOtpHtmlFallback(params: {
  toName: string;
  otp: string;
  purpose: OtpPurpose;
  expiryMinutes: number;
}): string {
  const purposeLabel = PURPOSE_LABELS[params.purpose];
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);border:1px solid #e2e8f0;">
    <div style="background:#0A192F;padding:28px 24px;text-align:center;border-bottom:3px solid #F59E0B;">
      <h1 style="color:#fff;font-size:20px;margin:0;letter-spacing:0.5px;text-transform:uppercase;">DSVV Campus Security</h1>
      <p style="color:#94A3B8;font-size:13px;margin:6px 0 0 0;">${UNIVERSITY}</p>
    </div>
    <div style="padding:28px 24px;">
      <p style="font-size:16px;font-weight:600;color:#0f172a;margin-bottom:8px;">Hello ${params.toName},</p>
      <p style="color:#475569;font-size:15px;margin-bottom:24px;">
        You requested a <strong>${purposeLabel}</strong> for your ${APP_NAME} account.
        Use the verification code below to continue.
      </p>
      <div style="background:#F8FAFC;border:2px dashed #CBD5E1;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
        <p style="font-size:13px;color:#64748B;margin:0 0 8px 0;">Your One-Time Verification Code</p>
        <div style="font-family:monospace;font-size:40px;font-weight:bold;letter-spacing:12px;color:#0284c7;">${params.otp}</div>
        <p style="font-size:12px;color:#94A3B8;margin:8px 0 0 0;">Valid for ${params.expiryMinutes} minutes &bull; Single use only</p>
      </div>
      <p style="color:#EF4444;font-size:13px;margin-top:16px;">
        ⚠️ Never share this code with anyone. Campus Security staff will never ask for your OTP.
      </p>
    </div>
    <div style="background:#F8FAFC;padding:16px 24px;text-align:center;font-size:12px;color:#94A3B8;border-top:1px solid #E2E8F0;">
      ${UNIVERSITY}, Shantikunj, Haridwar, Uttarakhand – 249411<br>
      Automated Security Message &bull; Do not reply to this email.
    </div>
  </div>
</body>
</html>`;
}
