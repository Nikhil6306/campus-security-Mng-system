import "server-only";

import type { VisitStatus } from "@/lib/types";
import { STATUS_CODES } from "@/lib/types";
import { findVisit, findVisitByToken, listGuests, readSettings } from "../repo";
import { notFound } from "../errors";
import { passUrlFor } from "../notification-service";
import {
  messagesForBooking,
  providerStatus,
  sendBookingMessage,
} from "./whatsapp";

/**
 * The visitor pass: public verification, and delivery of the pass to WhatsApp.
 *
 * Everything here is deliberately narrow about what it discloses. The
 * verification view is reachable by anyone holding the scanned token, so it
 * carries only what a gate officer needs to admit somebody — never an address,
 * a contact number, an email or any Aadhaar fragment.
 */

/* ------------------------------------------------------------------ *
 * QR verification
 * ------------------------------------------------------------------ */

/** Statuses a scanned pass is still good for. */
const ADMISSIBLE: VisitStatus[] = ["Approved", "Checked In", "Meeting In Progress"];

/** Statuses that are legitimate but not yet an entitlement to enter. */
const PENDING: VisitStatus[] = ["Pending", "Rescheduled"];

export interface PassVerification {
  /** True only when the booking currently entitles the holder to enter. */
  valid: boolean;
  /** True when the token matched a booking at all. */
  found: boolean;
  bookingId?: string;
  primaryVisitor?: string;
  visitDate?: string;
  visitTime?: string;
  totalVisitors?: number;
  status?: VisitStatus;
  statusCode?: string;
  hostName?: string;
  department?: string;
  campusName: string;
  /** Names of the accompanying party — no contact details, no Aadhaar. */
  partyNames?: string[];
  /** Why a found pass is not admissible, in words a gate officer can act on. */
  reason?: string;
}

/**
 * Resolves a scanned token.
 *
 * An unknown token and a revoked one are reported differently on purpose: the
 * token is 24 random bytes, so an unknown value is a mis-scan rather than an
 * attack, and staff need to be told which situation they are in. Cancelled,
 * rejected and expired bookings are found but never valid — that is what makes
 * a pass revocable.
 */
export function verifyPassToken(token: string): PassVerification {
  const settings = readSettings();
  const campusName = settings.campusName;

  const trimmed = token.trim();
  if (!trimmed) return { valid: false, found: false, campusName };

  const booking = findVisitByToken(trimmed);
  if (!booking) return { valid: false, found: false, campusName };

  const lapsed = Boolean(
    booking.passExpiresAt && Date.parse(booking.passExpiresAt) < Date.now(),
  );
  const admissible = ADMISSIBLE.includes(booking.status) && !lapsed;
  const pending = PENDING.includes(booking.status) && !lapsed;

  const reason = admissible
    ? undefined
    : lapsed
      ? "This pass has expired and is no longer valid for entry."
      : pending
        ? "This visit has not been approved yet. Do not admit on this pass."
        : `This pass is no longer valid — the booking is ${booking.status.toLowerCase()}.`;

  return {
    valid: admissible,
    found: true,
    bookingId: booking.id,
    primaryVisitor: booking.fullName,
    visitDate: booking.visitDate,
    visitTime: booking.visitTime,
    totalVisitors: booking.numberOfVisitors,
    status: booking.status,
    statusCode: STATUS_CODES[booking.status],
    hostName: booking.hostName,
    department: booking.department,
    campusName,
    partyNames: listGuests(booking.id).map((guest) => guest.fullName),
    reason,
  };
}

/* ------------------------------------------------------------------ *
 * WhatsApp delivery of the pass
 * ------------------------------------------------------------------ */

export type DeliveryState = "sent" | "simulated" | "failed" | "queued" | "none";

export interface DeliveryReport {
  state: DeliveryState;
  /** Provider name only — never a credential. */
  provider: string;
  /** False whenever messages are recorded but not transmitted. */
  live: boolean;
  /** Visitor-facing explanation; safe to render verbatim. */
  detail: string;
  at?: string;
  /** Masked recipient, e.g. `+91••••••3210`. */
  to?: string;
}

const CONFIG_HINT =
  "WhatsApp delivery is pending configuration on this campus. Your booking is confirmed — download your pass below.";

function describe(state: DeliveryState, live: boolean): string {
  switch (state) {
    case "sent":
      return "Your visit pass has been sent to your WhatsApp number.";
    case "simulated":
      return CONFIG_HINT;
    case "queued":
      return "Your visit pass is queued for delivery to WhatsApp.";
    case "failed":
      return live
        ? "WhatsApp delivery could not be completed. You can download your pass below and try again."
        : CONFIG_HINT;
    default:
      return live
        ? "Your visit pass has not been sent to WhatsApp yet."
        : CONFIG_HINT;
  }
}

/** Reads the current delivery state for a booking without sending anything. */
export function deliveryReport(bookingId: string): DeliveryReport {
  const status = providerStatus();
  const messages = messagesForBooking(bookingId).filter(
    (message) => message.messageType === "booking_created",
  );
  const latest = messages[messages.length - 1];

  if (!latest) {
    return {
      state: "none",
      provider: status.provider,
      live: status.live,
      detail: describe("none", status.live),
    };
  }

  const state: DeliveryState = latest.simulated
    ? "simulated"
    : latest.status === "FAILED"
      ? "failed"
      : latest.status === "QUEUED"
        ? "queued"
        : "sent";

  return {
    state,
    provider: latest.provider,
    live: !latest.simulated,
    detail: describe(state, !latest.simulated),
    at: latest.sentAt ?? latest.updatedAt,
    // The visitor typed this number; masking it still avoids putting a full
    // contact number into a response that may be logged upstream.
    to: latest.phoneNumber.replace(/\d(?=\d{4})/g, "•"),
  };
}

/**
 * Sends — or re-sends — the booking's WhatsApp pass message.
 *
 * Delegates to the existing delivery service, which is keyed on a dedupe key:
 * pressing the button twice cannot put two copies in the visitor's chat, and a
 * previously failed message is retried on its original row.
 */
export async function deliverPass(bookingId: string): Promise<DeliveryReport> {
  const booking = findVisit(bookingId);
  if (!booking) throw notFound("No booking found for that reference.");

  const settings = readSettings();
  await sendBookingMessage({
    type: "booking_created",
    booking,
    campusName: settings.campusName,
    passUrl: passUrlFor(booking),
    securityPhone: settings.securityDeskPhone,
  });

  return deliveryReport(bookingId);
}
