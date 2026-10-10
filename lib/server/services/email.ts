import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CampusEmail {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export interface CampusEmailReceipt {
  id: string;
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured before sending email.`);
  }
  return value;
}

function validateAddress(address: string, field: string): void {
  if (!EMAIL_ADDRESS.test(address)) {
    throw new Error(`${field} must contain a valid email address.`);
  }
}

export async function sendCampusEmail(
  message: CampusEmail,
): Promise<CampusEmailReceipt> {
  const apiKey = requiredEnvironmentVariable("RESEND_API_KEY");
  const from = requiredEnvironmentVariable("RESEND_FROM_EMAIL");
  const recipients = Array.isArray(message.to) ? message.to : [message.to];

  validateAddress(from, "RESEND_FROM_EMAIL");
  if (!recipients.length) {
    throw new Error("At least one email recipient is required.");
  }
  recipients.forEach((recipient) => validateAddress(recipient, "Recipient"));
  if (!message.subject.trim() || /[\r\n]/.test(message.subject)) {
    throw new Error("Email subject must be non-empty and contain no line breaks.");
  }
  if (!message.html?.trim() && !message.text?.trim()) {
    throw new Error("Email must include HTML or plain-text content.");
  }
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.RESEND_ENABLE_DEVELOPMENT_DELIVERY !== "true"
  ) {
    throw new Error(
      "Resend delivery is disabled outside production. Set RESEND_ENABLE_DEVELOPMENT_DELIVERY=true only when live delivery is intended.",
    );
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: message.subject,
      ...(message.html ? { html: message.html } : {}),
      ...(message.text ? { text: message.text } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the email request (HTTP ${response.status}).`);
  }

  const result: unknown = await response.json();
  if (
    typeof result !== "object" ||
    result === null ||
    !("id" in result) ||
    typeof result.id !== "string" ||
    !result.id
  ) {
    throw new Error("Resend returned an invalid email receipt.");
  }

  return { id: result.id };
}
