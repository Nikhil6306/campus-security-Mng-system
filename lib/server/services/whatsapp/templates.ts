import "server-only";

import type { VisitRequest } from "@/lib/types";
import { formatDateLong, formatTime } from "@/lib/utils";

/**
 * Outbound message bodies.
 *
 * Every WhatsApp string in the system is built here. Nothing in the booking or
 * gate services composes prose of its own, so wording changes — or a future
 * translation — happen in exactly one file.
 */

export type WhatsAppMessageType =
  | "faculty_visit_request"
  | "booking_created"
  | "booking_approved"
  | "booking_rejected"
  | "booking_rescheduled"
  | "visitor_checked_in"
  | "meeting_started"
  | "meeting_completed"
  | "visitor_checked_out";

export const WHATSAPP_MESSAGE_TYPES: WhatsAppMessageType[] = [
  "faculty_visit_request",
  "booking_created",
  "booking_approved",
  "booking_rejected",
  "booking_rescheduled",
  "visitor_checked_in",
  "meeting_started",
  "meeting_completed",
  "visitor_checked_out",
];

export const WHATSAPP_MESSAGE_LABELS: Record<WhatsAppMessageType, string> = {
  faculty_visit_request: "Faculty visit request",
  booking_created: "Booking confirmation",
  booking_approved: "Approval & visitor pass",
  booking_rejected: "Booking declined",
  booking_rescheduled: "Booking rescheduled",
  visitor_checked_in: "Campus entry recorded",
  meeting_started: "Meeting started",
  meeting_completed: "Meeting completed",
  visitor_checked_out: "Visit completed",
};

export interface TemplateContext {
  booking: VisitRequest;
  campusName: string;
  /** Absolute URL of the visitor's digital pass. */
  passUrl: string;
  securityPhone?: string;
  /** Gate and timestamps for the gate-side messages. */
  gate?: string;
  checkInAt?: string;
  checkOutAt?: string;
  rejectionReason?: string;
  /**
   * Absolute URL of the faculty review screen. Carries the booking reference
   * only — the page itself requires an authenticated faculty session, and the
   * server checks that the booking is actually assigned to them.
   */
  reviewUrl?: string;
  /** Visitor contact, included only in the message to the host. */
  visitorContact?: string;
}

const RULE = "━━━━━━━━━━━━━━━━━━";

const clock = (iso?: string): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

/** The shared booking block every template opens with. */
function detailBlock(ctx: TemplateContext): string {
  const { booking } = ctx;
  const lines = [
    `Booking ID:\n${booking.id}`,
    `Visitor:\n${booking.fullName}`,
    `Purpose:\n${booking.purpose}`,
    `Meeting With:\n${booking.hostName || "Campus administration"}`,
    `Department:\n${booking.department || "—"}`,
    `Date:\n${formatDateLong(booking.visitDate)}`,
    `Time:\n${formatTime(booking.visitTime)}`,
    `Visitors:\n${booking.numberOfVisitors}`,
  ];
  if (booking.vehicleNumber) lines.push(`Vehicle:\n${booking.vehicleNumber}`);
  return lines.join("\n\n");
}

const signature = (ctx: TemplateContext): string =>
  `Thank you.\n${ctx.campusName}\nCampus Security${
    ctx.securityPhone ? `\nSecurity desk: ${ctx.securityPhone}` : ""
  }`;

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

const builders: Record<WhatsAppMessageType, (ctx: TemplateContext) => string> = {
  /**
   * Sent to the faculty member a visitor asked to meet.
   *
   * The only message that carries the visitor's contact number, because the
   * host may need to reach them before deciding. It carries no ID number, no
   * address and no Aadhaar fragment.
   */
  faculty_visit_request: (ctx) =>
    [
      `Hello ${ctx.booking.hostName},`,
      "",
      "You have a new campus visit request awaiting your decision.",
      "",
      `${ctx.campusName}`,
      "Campus Security Management System",
      "",
      RULE,
      "",
      "VISIT REQUEST",
      "",
      detailBlock(ctx),
      ctx.visitorContact ? `\n\nVisitor contact:\n${ctx.visitorContact}` : "",
      "",
      RULE,
      "",
      "Please review and approve or decline this request.",
      // The photograph is named, never attached and never linked: the image
      // lives in private storage and is readable only inside the review screen,
      // behind the host's own session. Putting a storage URL in a WhatsApp
      // message would make a visitor's face forwardable to anyone.
      ctx.booking.photoUrl
        ? "The visitor's photo is attached to the request and is visible on the review screen."
        : "",
      "",
      ctx.reviewUrl ? `Review request:
${ctx.reviewUrl}` : "",
      "",
      "The visitor is told only once you have decided.",
      "",
      signature(ctx),
    ]
      .filter((line) => line !== "")
      .join("\n"),

  booking_created: (ctx) =>
    [
      `Hello ${ctx.booking.fullName},`,
      "",
      "Your campus visit booking has been successfully submitted.",
      "",
      `${ctx.campusName}`,
      "Campus Security Management System",
      "",
      RULE,
      "",
      "BOOKING DETAILS",
      "",
      detailBlock(ctx),
      "",
      "Status:\nPENDING APPROVAL",
      "",
      RULE,
      "",
      "Your booking is currently awaiting approval.",
      "You will receive another WhatsApp notification once your booking is approved.",
      "",
      `Visitor Pass:\n${ctx.passUrl}`,
      "",
      "Please keep your Booking ID available when arriving at the campus.",
      "",
      signature(ctx),
    ].join("\n"),

  booking_approved: (ctx) =>
    [
      `Hello ${ctx.booking.fullName},`,
      "",
      "Your campus visit has been APPROVED.",
      "",
      `${ctx.campusName}`,
      "",
      RULE,
      "",
      "VISITOR PASS",
      "",
      detailBlock(ctx),
      "",
      "Status:\nAPPROVED",
      "",
      RULE,
      "",
      "Your digital visitor pass is ready.",
      "",
      `Open Visitor Pass:\n${ctx.passUrl}`,
      "",
      "Your QR code will be verified by the security guard at the campus entry gate.",
      "Please carry a valid ID document as required by campus security.",
      "",
      signature(ctx),
    ].join("\n"),

  booking_rejected: (ctx) =>
    [
      `Hello ${ctx.booking.fullName},`,
      "",
      "We are unable to confirm your campus visit request.",
      "",
      `${ctx.campusName}`,
      "",
      RULE,
      "",
      detailBlock(ctx),
      "",
      "Status:\nNOT APPROVED",
      ctx.rejectionReason ? `\nReason:\n${ctx.rejectionReason}` : "",
      "",
      RULE,
      "",
      "You may submit a fresh booking for another date or time.",
      "",
      signature(ctx),
    ]
      .filter((line) => line !== "")
      .join("\n"),

  booking_rescheduled: (ctx) =>
    [
      `Hello ${ctx.booking.fullName},`,
      "",
      "Your campus visit has been rescheduled.",
      "",
      `${ctx.campusName}`,
      "",
      RULE,
      "",
      "UPDATED BOOKING",
      "",
      detailBlock(ctx),
      "",
      "Status:\nRESCHEDULED",
      "",
      RULE,
      "",
      "Please note the new date and time above.",
      "",
      `Visitor Pass:\n${ctx.passUrl}`,
      "",
      signature(ctx),
    ].join("\n"),

  visitor_checked_in: (ctx) =>
    [
      `Hello ${ctx.booking.fullName},`,
      "",
      `Your entry into ${ctx.campusName} has been recorded.`,
      "",
      RULE,
      "",
      `Booking ID:\n${ctx.booking.id}`,
      "",
      `Entry Time:\n${clock(ctx.checkInAt ?? ctx.booking.checkInAt)}`,
      "",
      `Gate:\n${ctx.gate ?? ctx.booking.gate ?? "Main Gate"}`,
      "",
      `Meeting With:\n${ctx.booking.hostName || "Campus administration"}`,
      "",
      "Status:\nCHECKED IN",
      "",
      RULE,
      "",
      "Please proceed according to campus security instructions.",
      "",
      signature(ctx),
    ].join("\n"),

  meeting_started: (ctx) =>
    [
      `Hello ${ctx.booking.fullName},`,
      "",
      `Your meeting with ${ctx.booking.hostName || "campus administration"} has started.`,
      "",
      `Booking ID:\n${ctx.booking.id}`,
      "",
      "Status:\nMEETING IN PROGRESS",
      "",
      signature(ctx),
    ].join("\n"),

  meeting_completed: (ctx) =>
    [
      `Hello ${ctx.booking.fullName},`,
      "",
      "Your meeting has been marked complete.",
      "",
      `Booking ID:\n${ctx.booking.id}`,
      "",
      "Please complete your check-out at the campus gate before leaving.",
      "",
      signature(ctx),
    ].join("\n"),

  visitor_checked_out: (ctx) =>
    [
      `Hello ${ctx.booking.fullName},`,
      "",
      "Your campus visit has been completed.",
      "",
      RULE,
      "",
      `Booking ID:\n${ctx.booking.id}`,
      "",
      `Check-In:\n${clock(ctx.checkInAt ?? ctx.booking.checkInAt)}`,
      "",
      `Check-Out:\n${clock(ctx.checkOutAt ?? ctx.booking.checkOutAt)}`,
      "",
      `Gate:\n${ctx.gate ?? ctx.booking.gate ?? "Main Gate"}`,
      "",
      "Status:\nCHECKED OUT",
      "",
      RULE,
      "",
      `Thank you for visiting ${ctx.campusName}.`,
      "",
      signature(ctx),
    ].join("\n"),
};

export function renderTemplate(type: WhatsAppMessageType, ctx: TemplateContext): string {
  return builders[type](ctx);
}

/** Sample body for the settings screen's template preview. */
export function templatePreview(type: WhatsAppMessageType, ctx: TemplateContext): string {
  return renderTemplate(type, ctx);
}
