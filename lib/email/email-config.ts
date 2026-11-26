/**
 * EmailJS configuration for the DSVV Campus Security Management System.
 * All keys are server-only — never use NEXT_PUBLIC_ prefix on private keys.
 */

export const EMAIL_CONFIG = {
  serviceId: process.env.EMAILJS_SERVICE_ID ?? "",
  publicKey: process.env.EMAILJS_PUBLIC_KEY ?? "",
  privateKey: process.env.EMAILJS_PRIVATE_KEY ?? "",
  templates: {
    otp: process.env.EMAILJS_OTP_TEMPLATE_ID ?? "",
    notification: process.env.EMAILJS_NOTIFICATION_TEMPLATE_ID ?? "",
    welcome: process.env.EMAILJS_WELCOME_TEMPLATE_ID ?? "",
    securityAlert: process.env.EMAILJS_SECURITY_ALERT_TEMPLATE_ID ?? "",
  },
  appName: process.env.APP_NAME ?? "DSVV Campus Security Management System",
  appUrl: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supportEmail: process.env.APP_SUPPORT_EMAIL ?? "security@dsvv.ac.in",
};

export const OTP_CONFIG = {
  expiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? "5"),
  maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? "5"),
  resendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? "60"),
  length: Number(process.env.OTP_LENGTH ?? "6"),
};

export const SECURITY_CONFIG = {
  rateLimitEnabled: process.env.AUTH_RATE_LIMIT_ENABLED !== "false",
  emailNotificationsEnabled: process.env.EMAIL_NOTIFICATION_ENABLED !== "false",
};

export function isEmailJsConfigured(): boolean {
  return Boolean(
    EMAIL_CONFIG.serviceId &&
    EMAIL_CONFIG.privateKey &&
    EMAIL_CONFIG.templates.otp,
  );
}
