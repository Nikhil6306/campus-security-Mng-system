import "server-only";

import type { Incident, Teacher, VisitRequest } from "@/lib/types";
import { STATUS_CODES } from "@/lib/types";
import { readSettings } from "./repo";
import { dispatch as dispatchWhatsApp } from "./services/whatsapp";
import type { WhatsAppMessageType } from "./services/whatsapp/templates";

/**
 * Outbound messaging.
 *
 * The application never talks to an email or SMS provider directly — it calls
 * the methods below, and a transport decides what actually happens. No provider
 * is configured in this deployment, so the default transport records the
 * message on the server log and returns; wiring a real one means implementing
 * {@link NotificationTransport} and passing it to {@link setTransport}, with no
 * change to any caller.
 *
 * In-app notifications are a different channel and are written to the database
 * directly by `lib/server/audit.ts` — those are always delivered.
 */

export interface OutboundMessage {
  channel: "email" | "sms" | "push";
  to: string;
  subject: string;
  body: string;
  /** Correlates the message with the record that triggered it. */
  reference: string;
}

export interface NotificationTransport {
  send(message: OutboundMessage): Promise<void> | void;
}

/**
 * Default transport: log and drop.
 *
 * It deliberately logs the recipient and subject only. Writing visitor phone
 * numbers, ID numbers or message bodies into server logs would move personal
 * data somewhere it is neither protected by the database's access rules nor
 * covered by any retention policy.
 */
const consoleTransport: NotificationTransport = {
  send(message) {
    if (process.env.NODE_ENV === "test") return;
    console.info(
      `[notification] ${message.channel} → ${maskRecipient(message.to)} · ${message.subject} · ref ${message.reference}`,
    );
  },
};

let transport: NotificationTransport = consoleTransport;

export function setTransport(next: NotificationTransport): void {
  transport = next;
}

function maskRecipient(value: string): string {
  if (value.includes("@")) {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return value.length > 4 ? `${"*".repeat(value.length - 4)}${value.slice(-4)}` : value;
}

/* ------------------------------------------------------------------ *
 * WhatsApp
 * ------------------------------------------------------------------ */

/**
 * Public origin used to build the visitor pass link inside a WhatsApp message.
 *
 * A relative path is useless in a chat app, so this has to be absolute. It
 * falls back to localhost for development; set `NEXT_PUBLIC_APP_URL` before
 * sending anything a real visitor will open.
 */
function appOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  return (configured ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * The faculty review screen for one booking.
 *
 * Carries the booking reference only. The page is behind the staff session,
 * and the API re-checks that the booking is assigned to the caller — holding
 * this link grants nothing on its own.
 */
export function reviewUrlFor(booking: VisitRequest): string {
  return `${appOrigin()}/teacher/meetings?request=${encodeURIComponent(booking.id)}`;
}

export function passUrlFor(booking: VisitRequest): string {
  // The token is the unguessable half; the reference is what the visitor can
  // quote at the desk, so the link carries the token when one has been issued.
  const reference = booking.passToken ?? booking.id;
  return `${appOrigin()}/visitor/pass/${encodeURIComponent(reference)}`;
}

/**
 * Hands one lifecycle event to the WhatsApp service.
 *
 * Detached on purpose: a WhatsApp outage must never fail a booking, a check-in
 * or a check-out. The delivery log records what happened either way.
 */
function whatsapp(
  type: WhatsAppMessageType,
  booking: VisitRequest,
  extra: {
    gate?: string;
    rejectionReason?: string;
    dedupeSalt?: string;
    reviewUrl?: string;
    visitorContact?: string;
    to?: { countryCode: string; number: string };
    audience?: "visitor" | "faculty";
  } = {},
): void {
  try {
    const settings = readSettings();
    dispatchWhatsApp({
      type,
      booking,
      campusName: settings.campusName,
      passUrl: passUrlFor(booking),
      securityPhone: settings.securityDeskPhone,
      checkInAt: booking.checkInAt,
      checkOutAt: booking.checkOutAt,
      ...extra,
    });
  } catch (error) {
    console.error("[notification] whatsapp dispatch failed", error);
  }
}

/** Never let a messaging failure roll back the operation that triggered it. */
function dispatch(message: OutboundMessage): void {
  try {
    void transport.send(message);
  } catch (error) {
    console.error("[notification] transport failed", error);
  }
}

function recipient(booking: VisitRequest): string {
  return booking.email || booking.mobile;
}

export const notificationService = {
  /**
   * Tells the host a visitor has asked to meet them.
   *
   * Sent from the campus WhatsApp Business number to the faculty member's own
   * number — never from or to the visitor. The host's number is read here, on
   * the server, from the staff directory; it never reaches a browser.
   */
  sendFacultyVisitRequest(booking: VisitRequest, host: Teacher): void {
    const number = (host.whatsappNumber || host.phone || "").replace(/[ -]/g, "");
    if (!number) return;

    dispatch({
      channel: host.email ? "email" : "sms",
      to: host.email || number,
      subject: `New visit request — ${booking.id}`,
      body:
        `${booking.fullName} has requested to meet you on ${booking.visitDate} at ` +
        `${booking.visitTime}. Review it in your meetings queue.`,
      reference: booking.id,
    });

    whatsapp("faculty_visit_request", booking, {
      to: { countryCode: "+91", number },
      audience: "faculty",
      reviewUrl: reviewUrlFor(booking),
      // The host may need to reach the visitor before deciding.
      visitorContact: booking.mobile,
    });
  },

  sendBookingConfirmation(booking: VisitRequest): void {
    dispatch({
      channel: booking.email ? "email" : "sms",
      to: recipient(booking),
      subject: `Visit request received — ${booking.id}`,
      body:
        `Your visit request for ${booking.visitDate} at ${booking.visitTime} with ${booking.hostName} ` +
        `has been received and is awaiting approval. Track it with reference ${booking.id}.`,
      reference: booking.id,
    });
    whatsapp("booking_created", booking);
  },

  sendApproval(booking: VisitRequest): void {
    dispatch({
      channel: booking.email ? "email" : "sms",
      to: recipient(booking),
      subject: `Visit approved — ${booking.id}`,
      body:
        `Your visit on ${booking.visitDate} at ${booking.visitTime} is approved. ` +
        `Show your digital pass at the gate. Status: ${STATUS_CODES[booking.status]}.`,
      reference: booking.id,
    });
    whatsapp("booking_approved", booking);
  },

  sendRejection(booking: VisitRequest, reason: string): void {
    dispatch({
      channel: booking.email ? "email" : "sms",
      to: recipient(booking),
      subject: `Visit could not be approved — ${booking.id}`,
      body: `Your visit request for ${booking.visitDate} was not approved. Reason: ${reason}`,
      reference: booking.id,
    });
    whatsapp("booking_rejected", booking, { rejectionReason: reason });
  },

  sendReschedule(booking: VisitRequest): void {
    dispatch({
      channel: booking.email ? "email" : "sms",
      to: recipient(booking),
      subject: `Visit rescheduled — ${booking.id}`,
      body: `Your visit has been moved to ${booking.visitDate} at ${booking.visitTime}. It is awaiting re-confirmation.`,
      reference: booking.id,
    });
    // A second reschedule is a genuinely new message, so the slot joins the key.
    whatsapp("booking_rescheduled", booking, {
      dedupeSalt: `${booking.visitDate}T${booking.visitTime}`,
    });
  },

  sendCheckIn(booking: VisitRequest): void {
    dispatch({
      channel: "push",
      to: booking.hostName,
      subject: `Visitor arrived — ${booking.fullName}`,
      body: `${booking.fullName} checked in at ${booking.gate ?? "the gate"} for your ${booking.visitTime} meeting.`,
      reference: booking.id,
    });
    whatsapp("visitor_checked_in", booking, { gate: booking.gate });
  },

  sendCheckOut(booking: VisitRequest): void {
    dispatch({
      channel: booking.email ? "email" : "sms",
      to: recipient(booking),
      subject: `Visit complete — ${booking.id}`,
      body: `Thank you for visiting. You were checked out at ${booking.gate ?? "the gate"}.`,
      reference: booking.id,
    });
    whatsapp("visitor_checked_out", booking, { gate: booking.gate });
  },

  /** Optional courtesy messages around the meeting itself. */
  sendMeetingStarted(booking: VisitRequest): void {
    whatsapp("meeting_started", booking);
  },

  sendMeetingCompleted(booking: VisitRequest): void {
    whatsapp("meeting_completed", booking);
  },

  sendIncidentAlert(incident: Incident, to: string): void {
    dispatch({
      channel: "push",
      to,
      subject: `${incident.severity} incident — ${incident.type}`,
      body: `${incident.title} reported at ${incident.location}.`,
      reference: incident.id,
    });
  },

  sendMeetingReminder(booking: VisitRequest): void {
    dispatch({
      channel: "push",
      to: booking.hostName,
      subject: `Upcoming meeting — ${booking.visitTime}`,
      body: `${booking.fullName} is scheduled to meet you at ${booking.visitTime}.`,
      reference: booking.id,
    });
  },
};
