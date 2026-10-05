import "server-only";

import type { AuthSession, VisitRequest } from "@/lib/types";
import { all, get, run, toNum, toOptText, toText } from "../../db";
import type { Row } from "../../db";
import { publish } from "../../events";
import { notFound } from "../../errors";
import { findVisit, readSettings, mapVisit } from "../../repo";
import { getProvider, providerStatus, type ProviderStatus } from "./provider";
import {
  WHATSAPP_MESSAGE_LABELS,
  WHATSAPP_MESSAGE_TYPES,
  renderTemplate,
  type TemplateContext,
  type WhatsAppMessageType,
} from "./templates";

/**
 * WhatsApp delivery.
 *
 * Two rules shape this module:
 *
 *  1. A notification must never fail a booking. Every send is attempted after
 *     the booking transaction has already committed, and a transport failure
 *     is recorded as a FAILED row rather than thrown at the caller.
 *  2. A retry must never send twice. The row is written first, keyed on
 *     `dedupe_key`; a replay collides on the unique index and is skipped
 *     before the provider is ever contacted.
 */

export type WhatsAppStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";

export interface WhatsAppMessageRecord {
  id: string;
  bookingId?: string;
  visitorId?: string;
  phoneNumber: string;
  messageType: WhatsAppMessageType | string;
  label: string;
  body: string;
  provider: string;
  providerMessageId?: string;
  status: WhatsAppStatus;
  attempts: number;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
  /** False when the row was produced by the mock adapter. */
  simulated: boolean;
}

const now = () => new Date().toISOString();

/**
 * Body parameters for an approved WhatsApp template.
 *
 * Kept beside the plain-text templates so the two cannot drift: the order here
 * is the order the registered template must declare, and it is documented in
 * `.env.example` beside WHATSAPP_TEMPLATE_NAME.
 *
 * Nothing sensitive goes into a variable — no Aadhaar fragment, no address, no
 * ID number.
 */
/** The faculty notice has its own approved template; everything else shares one. */
function templateFor(type: WhatsAppMessageType): string | null {
  if (type === "faculty_visit_request") {
    return process.env.WHATSAPP_FACULTY_TEMPLATE_NAME?.trim() || null;
  }
  return null;
}

function templateVariablesFor(type: WhatsAppMessageType, booking: VisitRequest): string[] {
  const common = [
    booking.fullName || "",
    booking.id || "",
    booking.visitDate || "",
    booking.visitTime || "",
    String(booking.numberOfVisitors || 1),
  ];
  switch (type) {
    case "faculty_visit_request":
      return [
        booking.hostName || "Host",
        booking.fullName || "",
        booking.id || "",
        booking.visitDate || "",
        booking.visitTime || "",
      ];
    case "booking_created":
    case "booking_approved":
    case "booking_rescheduled":
      return common;
    default:
      // Lifecycle notices stay as text: they only ever follow a message the
      // visitor has already received, so the service window is open.
      return [];
  }
}

function mapMessage(r: Row): WhatsAppMessageRecord {
  const type = toText(r.message_type);
  const provider = toText(r.provider);
  return {
    id: toText(r.id),
    bookingId: toOptText(r.booking_id),
    visitorId: toOptText(r.visitor_id),
    phoneNumber: toText(r.phone_number),
    messageType: type,
    label: WHATSAPP_MESSAGE_LABELS[type as WhatsAppMessageType] ?? type,
    body: toText(r.body),
    provider,
    providerMessageId: toOptText(r.provider_message_id),
    status: toText(r.status) as WhatsAppStatus,
    attempts: toNum(r.attempts),
    errorMessage: toOptText(r.error_message),
    sentAt: toOptText(r.sent_at),
    deliveredAt: toOptText(r.delivered_at),
    readAt: toOptText(r.read_at),
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
    simulated: provider === "mock",
  };
}

/* ------------------------------------------------------------------ *
 * Phone numbers
 * ------------------------------------------------------------------ */

/**
 * Normalises a country code and number to E.164 digits (no `+`).
 *
 * Returns null when the result cannot be a dialable number, which the caller
 * treats as "this visitor has no WhatsApp contact" rather than as an error.
 */
export function normaliseWhatsApp(countryCode: string, number: string): string | null {
  const cc = (countryCode || "").replace(/[^\d]/g, "");
  const digits = (number || "").replace(/[^\d]/g, "");
  if (!cc || !digits) return null;

  // A number already carrying its country code should not gain a second one.
  const local = digits.startsWith(cc) && digits.length > 10 ? digits.slice(cc.length) : digits;
  if (local.length < 6 || local.length > 12) return null;
  return `${cc}${local}`;
}

/** `+91 98765 43210` for display; never used as a transport address. */
export function formatWhatsApp(countryCode: string, number: string): string {
  const cc = (countryCode || "").replace(/[^\d]/g, "");
  const digits = (number || "").replace(/[^\d]/g, "");
  if (!cc || !digits) return "";
  return `+${cc} ${digits}`;
}

/** Masked form for anywhere a full number should not be shown. */
export function maskWhatsApp(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 4) return "•••";
  return `+${digits.slice(0, digits.length - 4).replace(/\d/g, "•")}${digits.slice(-4)}`;
}

/* ------------------------------------------------------------------ *
 * Sending
 * ------------------------------------------------------------------ */

export interface SendOptions {
  type: WhatsAppMessageType;
  booking: VisitRequest;
  campusName: string;
  passUrl: string;
  securityPhone?: string;
  gate?: string;
  checkInAt?: string;
  checkOutAt?: string;
  rejectionReason?: string;
  reviewUrl?: string;
  visitorContact?: string;
  /**
   * Overrides the recipient.
   *
   * Booking messages go to the visitor's own number by default. A staff
   * notification — the faculty visit request — names its recipient here
   * instead, so the host is messaged rather than the visitor.
   */
  to?: { countryCode: string; number: string };
  /**
   * Which party this message is for. Part of the dedupe key, so the host's
   * copy and the visitor's copy of the same event never collide.
   */
  audience?: "visitor" | "faculty";
  /**
   * Distinguishes repeatable events. A reschedule to a new slot is a new
   * message; a replay of the same reschedule is not.
   */
  dedupeSalt?: string;
}

/**
 * Queues and attempts one message.
 *
 * Always resolves. The return value says what happened so a caller that cares
 * (the admin "resend" button) can report it; the booking flow ignores it.
 */
export async function sendBookingMessage(
  options: SendOptions,
): Promise<{ sent: boolean; simulated: boolean; reason?: string }> {
  const { booking, type } = options;

  const recipient = options.to ?? {
    countryCode: booking.whatsappCountryCode ?? "+91",
    number: booking.whatsappNumber ?? "",
  };
  const to = normaliseWhatsApp(recipient.countryCode, recipient.number);
  if (!to) {
    return {
      sent: false,
      simulated: false,
      reason: options.to
        ? "No WhatsApp number on file for that recipient."
        : "No WhatsApp number on this booking.",
    };
  }

  const audience = options.audience ?? "visitor";
  const dedupeKey = `${booking.id}:${type}:${audience}${
    options.dedupeSalt ? `:${options.dedupeSalt}` : ""
  }`;

  // Claim the key before contacting the provider. If this insert loses the
  // race, another request is already sending the same message.
  const existing = get<Row>("SELECT * FROM whatsapp_messages WHERE dedupe_key = ?", [dedupeKey]);
  if (existing) {
    const record = mapMessage(existing);
    if (record.status !== "FAILED") {
      return { sent: true, simulated: record.simulated, reason: "Already sent." };
    }
    return retryMessage(record.id);
  }

  const provider = getProvider();
  const context: TemplateContext = {
    booking,
    campusName: options.campusName,
    passUrl: options.passUrl,
    securityPhone: options.securityPhone,
    gate: options.gate,
    checkInAt: options.checkInAt,
    checkOutAt: options.checkOutAt,
    rejectionReason: options.rejectionReason,
    reviewUrl: options.reviewUrl,
    visitorContact: options.visitorContact,
  };
  const body = renderTemplate(type, context);

  const id = `WA-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = now();

  try {
    run(
      `INSERT INTO whatsapp_messages
         (id, booking_id, visitor_id, phone_number, message_type, dedupe_key, body,
          provider, status, attempts, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        booking.id,
        booking.visitorId ?? null,
        to,
        type,
        dedupeKey,
        body,
        provider.name,
        "QUEUED",
        0,
        timestamp,
        timestamp,
      ],
    );
  } catch {
    // Unique violation on dedupe_key — a concurrent request got there first.
    return { sent: true, simulated: provider.name === "mock", reason: "Already queued." };
  }

  publish("whatsapp", "queued", booking.id);
  return deliver(id, to, body, templateVariablesFor(type, booking), templateFor(type));
}

/** Performs the transport attempt and records the outcome. */
async function deliver(
  id: string,
  to: string,
  body: string,
  templateVariables: string[] = [],
  templateName?: string | null,
): Promise<{ sent: boolean; simulated: boolean; reason?: string }> {
  const provider = getProvider();
  const result = await provider.send({
    to,
    body,
    templateVariables,
    templateName: templateName ?? undefined,
  });
  const timestamp = now();

  if (result.accepted) {
    run(
      `UPDATE whatsapp_messages
          SET status = ?, provider_message_id = ?, sent_at = ?, attempts = attempts + 1,
              error_message = NULL, provider = ?, updated_at = ?
        WHERE id = ?`,
      ["SENT", result.providerMessageId ?? null, timestamp, provider.name, timestamp, id],
    );
    publish("whatsapp", "sent", id);
    return {
      sent: true,
      simulated: !result.real,
      reason: result.real ? undefined : provider.configurationHint,
    };
  }

  run(
    `UPDATE whatsapp_messages
        SET status = ?, error_message = ?, attempts = attempts + 1, provider = ?, updated_at = ?
      WHERE id = ?`,
    ["FAILED", result.error ?? "The message could not be sent.", provider.name, timestamp, id],
  );
  publish("whatsapp", "failed", id);
  return { sent: false, simulated: !result.real, reason: result.error };
}

/**
 * Re-attempts one failed message.
 *
 * Reuses the original row and its dedupe key, so a retry can never become a
 * second copy in the visitor's chat.
 */
export async function retryMessage(
  id: string,
): Promise<{ sent: boolean; simulated: boolean; reason?: string }> {
  const row = get<Row>("SELECT * FROM whatsapp_messages WHERE id = ?", [id]);
  if (!row) throw notFound("That message is no longer on record.");
  const record = mapMessage(row);

  if (record.status !== "FAILED") {
    return { sent: true, simulated: record.simulated, reason: "This message already went out." };
  }

  run("UPDATE whatsapp_messages SET status = 'QUEUED', updated_at = ? WHERE id = ?", [now(), id]);

  // Recomputed rather than stored: a retry must use the same template shape as
  // the original attempt, and the booking is the source of truth for it.
  const booking = record.bookingId ? findVisit(record.bookingId) : undefined;
  const variables = booking
    ? templateVariablesFor(record.messageType as WhatsAppMessageType, booking)
    : [];

  return deliver(
    id,
    record.phoneNumber,
    record.body,
    variables,
    templateFor(record.messageType as WhatsAppMessageType),
  );
}

/**
 * Fire-and-forget wrapper used by the booking and gate services.
 *
 * A notification is never allowed to take a booking down with it: the promise
 * is detached, and anything it throws is logged, not propagated.
 */
export function dispatch(options: SendOptions): void {
  void sendBookingMessage(options).catch((error: unknown) => {
    console.error("[whatsapp] dispatch failed", error);
  });
}

/* ------------------------------------------------------------------ *
 * Reads and administration
 * ------------------------------------------------------------------ */

export function messagesForBooking(bookingId: string): WhatsAppMessageRecord[] {
  return all("SELECT * FROM whatsapp_messages WHERE booking_id = ? ORDER BY created_at", [
    bookingId,
  ]).map(mapMessage);
}

export function recentMessages(limit = 100): WhatsAppMessageRecord[] {
  return all("SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT ?", [
    Math.min(Math.max(limit, 1), 500),
  ]).map(mapMessage);
}

export interface WhatsAppOverview {
  status: ProviderStatus;
  counts: Record<WhatsAppStatus, number>;
  recent: WhatsAppMessageRecord[];
}

export function overview(limit = 50): WhatsAppOverview {
  const rows = all<{ status: string; c: number }>(
    "SELECT status, COUNT(*) AS c FROM whatsapp_messages GROUP BY status",
  );
  const counts: Record<WhatsAppStatus, number> = {
    QUEUED: 0,
    SENT: 0,
    DELIVERED: 0,
    READ: 0,
    FAILED: 0,
  };
  for (const row of rows) {
    if (row.status in counts) counts[row.status as WhatsAppStatus] = row.c;
  }
  return { status: providerStatus(), counts, recent: recentMessages(limit) };
}

/**
 * Delivery receipt from the provider's webhook.
 *
 * Statuses only ever move forward — a late `sent` callback arriving after a
 * `read` receipt must not walk the row backwards.
 */
const RANK: Record<WhatsAppStatus, number> = {
  QUEUED: 0,
  FAILED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
};

export function recordReceipt(
  providerMessageId: string,
  status: WhatsAppStatus,
  at = now(),
): boolean {
  const row = get<Row>("SELECT * FROM whatsapp_messages WHERE provider_message_id = ?", [
    providerMessageId,
  ]);
  if (!row) return false;

  const current = mapMessage(row);
  if (RANK[status] <= RANK[current.status]) return false;

  const column =
    status === "DELIVERED" ? "delivered_at" : status === "READ" ? "read_at" : "sent_at";
  run(`UPDATE whatsapp_messages SET status = ?, ${column} = ?, updated_at = ? WHERE id = ?`, [
    status,
    at,
    now(),
    current.id,
  ]);
  publish("whatsapp", "receipt", current.id);
  return true;
}

/**
 * The message catalogue for the settings screen.
 *
 * Each entry is rendered from a real booking where one exists, so what an
 * administrator previews is the text a visitor would actually receive rather
 * than a separate sample that could drift from the templates.
 */
export interface TemplateEntry {
  type: WhatsAppMessageType;
  label: string;
  preview: string;
}

export function templateCatalogue(): TemplateEntry[] {
  const settings = readSettings();
  const row = get<Row>(
    "SELECT * FROM visit_requests ORDER BY created_at DESC LIMIT 1",
  );
  const booking = row ? mapVisit(row) : null;
  if (!booking) return [];

  const context: TemplateContext = {
    booking,
    campusName: settings.campusName,
    passUrl: `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/visitor/pass/${booking.passToken ?? booking.id}`,
    securityPhone: settings.securityDeskPhone,
    gate: booking.gate,
    rejectionReason: booking.rejectionReason ?? "Host unavailable on that date.",
  };

  return WHATSAPP_MESSAGE_TYPES.map((type) => ({
    type,
    label: WHATSAPP_MESSAGE_LABELS[type],
    preview: renderTemplate(type, context),
  }));
}

/**
 * Admin "send test message".
 *
 * Deliberately outside the dedupe scheme — an operator checking the connection
 * expects each press to attempt a fresh send.
 */
export async function sendTestMessage(
  to: string,
  actor: AuthSession,
  campusName: string,
): Promise<{ sent: boolean; simulated: boolean; reason?: string }> {
  const provider = getProvider();
  const body =
    `${campusName} — Campus Security Management System\n\n` +
    `This is a test message requested by ${actor.name}.\n\n` +
    `If you received this, WhatsApp delivery is configured correctly.`;

  const id = `WA-TEST-${Date.now().toString(36)}`;
  const timestamp = now();
  run(
    `INSERT INTO whatsapp_messages
       (id, booking_id, visitor_id, phone_number, message_type, dedupe_key, body,
        provider, status, attempts, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      null,
      null,
      to,
      "connection_test",
      id,
      body,
      provider.name,
      "QUEUED",
      0,
      timestamp,
      timestamp,
    ],
  );

  return deliver(id, to, body);
}

export { providerStatus } from "./provider";
export {
  WHATSAPP_MESSAGE_LABELS,
  WHATSAPP_MESSAGE_TYPES,
  type WhatsAppMessageType,
} from "./templates";
