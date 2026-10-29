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
  /** Signed action URLs for interactive decision links. */
  acceptUrl?: string;
  rejectUrl?: string;
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
   * Includes secure single-use Accept and Reject action links.
   */
  faculty_visit_request: (ctx) =>
    [
      `*Campus Security — New Visitor Request*`,
      "",
      `Dear ${ctx.booking.hostName || "Faculty Member"},`,
      "",
      `A visitor has requested to meet you at ${ctx.campusName}.`,
      "",
      RULE,
      `*Visitor:* ${ctx.booking.fullName}`,
      `*Purpose:* ${ctx.booking.purpose}`,
      `*Request Reference:* ${ctx.booking.id}`,
      `*Visit Date/Time:* ${formatDateLong(ctx.booking.visitDate)} at ${formatTime(ctx.booking.visitTime)}`,
      `*Number of Visitors:* ${ctx.booking.numberOfVisitors || 1}`,
      ctx.visitorContact ? `*Visitor Contact:* ${ctx.visitorContact}` : "",
      RULE,
      "",
      "Please review this request and select Accept or Reject:",
      "",
      ctx.acceptUrl ? `✅ *Accept Visit:*\n${ctx.acceptUrl}` : "",
      ctx.rejectUrl ? `❌ *Reject Visit:*\n${ctx.rejectUrl}` : "",
      ctx.reviewUrl ? `🔗 *Staff Portal Review:*\n${ctx.reviewUrl}` : "",
      "",
      "This request will remain pending until your decision is verified.",
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
      "Your booking is currently awaiting faculty approval.",
      "You will receive another WhatsApp notification once your booking is approved.",
      "",
      `Track your request status:\n${ctx.passUrl}`,
      "",
      "Please keep your Booking ID available.",
      "",
      signature(ctx),
    ].join("\n"),

  booking_approved: (ctx) =>
    [
      `*Campus Security — Visit Approved*`,
      "",
      `Hello ${ctx.booking.fullName},`,
      "",
      `Your request to meet ${ctx.booking.hostName || "campus staff"} has been approved.`,
      "",
      RULE,
      `*Request Reference:* ${ctx.booking.id}`,
      `*Visit Status:* APPROVED`,
      `*Date & Time:* ${formatDateLong(ctx.booking.visitDate)} at ${formatTime(ctx.booking.visitTime)}`,
      RULE,
      "",
      "Please present your digital visitor pass at the campus entrance and complete the required identity verification.",
      "",
      `📲 *Open Digital Visitor Pass:*`,
      `${ctx.passUrl}`,
      "",
      "Please note that the pass is subject to its validity period and campus security verification.",
      "",
      signature(ctx),
    ].join("\n"),

  booking_rejected: (ctx) =>
    [
      `*Campus Security — Request Update*`,
      "",
      `Hello ${ctx.booking.fullName},`,
      "",
      `We are sorry, but your request to meet ${ctx.booking.hostName || "campus staff"} could not be approved.`,
      "",
      `Request Reference: ${ctx.booking.id}`,
      "",
      "Thank you for your understanding.",
      "",
      "If your visit is still necessary, please contact the faculty member or the campus administration through the appropriate official channel.",
      "",
      "Regards,",
      "Campus Security Team",
      `${ctx.campusName}`,
    ].join("\n"),

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
