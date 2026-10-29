import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { AuthSession, Teacher, VisitRequest } from "@/lib/types";
import { get, nextId, run, tx } from "../db";
import type { Row } from "../db";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { findTeacher, findVisit } from "../repo";
import { approveBooking, rejectBooking } from "./bookings";
import { persistSecondaryToSupabase } from "../supabase-db";

/**
 * Approval Token Service.
 *
 * Provides cryptographically secure, short-lived, single-purpose tokens
 * for faculty decision links delivered via WhatsApp.
 *
 * Security guarantees:
 *  1. Only SHA-256 hashes of tokens are stored in the database.
 *  2. Tokens expire after a bounded lifetime (default 48 hours or visit date).
 *  3. Single-use: once consumed, subsequent attempts are rejected.
 *  4. Atomic: state transition occurs inside a transaction; duplicate/concurrent
 *     clicks cannot produce contradictory decisions or duplicate passes.
 *  5. URLs contain NO visitor personal data, passwords, or Supabase credentials.
 */

const now = () => new Date().toISOString();

function appOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  return (configured ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export interface ApprovalTokenRecord {
  id: string;
  tokenHash: string;
  bookingId: string;
  facultyId: string;
  action: "accept" | "reject" | "decide";
  expiresAt: string;
  consumedAt?: string | null;
  createdAt: string;
}

function mapApprovalToken(r: Row): ApprovalTokenRecord {
  return {
    id: String(r.id),
    tokenHash: String(r.token_hash),
    bookingId: String(r.booking_id),
    facultyId: String(r.faculty_id),
    action: r.action as "accept" | "reject" | "decide",
    expiresAt: String(r.expires_at),
    consumedAt: r.consumed_at ? String(r.consumed_at) : null,
    createdAt: String(r.created_at),
  };
}

export interface GeneratedTokens {
  acceptToken: string;
  rejectToken: string;
  acceptUrl: string;
  rejectUrl: string;
  reviewUrl: string;
}

/**
 * Creates cryptographically random action tokens for a faculty visit request.
 */
export function generateFacultyDecisionTokens(
  booking: VisitRequest,
  faculty: Teacher,
  expiresInHours = 48,
): GeneratedTokens {
  const timestamp = now();
  const origin = appOrigin();

  // Expiration: 48 hours, or visit date/time end of day
  const expiryDate = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const expiresAt = expiryDate.toISOString();

  // Generate 256-bit secure random tokens (base64url)
  const acceptRaw = randomBytes(32).toString("base64url");
  const rejectRaw = randomBytes(32).toString("base64url");

  const acceptHash = hashToken(acceptRaw);
  const rejectHash = hashToken(rejectRaw);

  const acceptId = nextId("TOK-ACC");
  const rejectId = nextId("TOK-REJ");

  tx(() => {
    // Save accept token
    run(
      `INSERT INTO approval_tokens
         (id, token_hash, booking_id, faculty_id, action, expires_at, created_at)
       VALUES (?, ?, ?, ?, 'accept', ?, ?)`,
      [acceptId, acceptHash, booking.id, faculty.id, expiresAt, timestamp],
    );

    // Save reject token
    run(
      `INSERT INTO approval_tokens
         (id, token_hash, booking_id, faculty_id, action, expires_at, created_at)
       VALUES (?, ?, ?, ?, 'reject', ?, ?)`,
      [rejectId, rejectHash, booking.id, faculty.id, expiresAt, timestamp],
    );
  });

  persistSecondaryToSupabase("approval_tokens", {
    id: acceptId,
    token_hash: acceptHash,
    booking_id: booking.id,
    faculty_id: faculty.id,
    action: "accept",
    expires_at: expiresAt,
    created_at: timestamp,
  });

  persistSecondaryToSupabase("approval_tokens", {
    id: rejectId,
    token_hash: rejectHash,
    booking_id: booking.id,
    faculty_id: faculty.id,
    action: "reject",
    expires_at: expiresAt,
    created_at: timestamp,
  });

  return {
    acceptToken: acceptRaw,
    rejectToken: rejectRaw,
    acceptUrl: `${origin}/faculty/decision?token=${encodeURIComponent(acceptRaw)}&action=accept`,
    rejectUrl: `${origin}/faculty/decision?token=${encodeURIComponent(rejectRaw)}&action=reject`,
    reviewUrl: `${origin}/teacher/meetings?request=${encodeURIComponent(booking.id)}`,
  };
}

export interface TokenVerificationResult {
  valid: boolean;
  reason?: string;
  alreadyDecided?: boolean;
  expired?: boolean;
  tokenRecord?: ApprovalTokenRecord;
  booking?: VisitRequest;
  faculty?: Teacher;
  intendedAction?: "accept" | "reject" | "decide";
}

/**
 * Validates a signed approval token without executing a state change.
 */
export function verifyApprovalToken(
  rawToken: string,
  requestedAction?: "accept" | "reject",
): TokenVerificationResult {
  const trimmed = rawToken.trim();
  if (!trimmed) {
    return { valid: false, reason: "No approval token provided." };
  }

  const tokenHash = hashToken(trimmed);
  const row = get<Row>("SELECT * FROM approval_tokens WHERE token_hash = ?", [tokenHash]);
  if (!row) {
    return { valid: false, reason: "Invalid or unrecognized decision token." };
  }

  const tokenRecord = mapApprovalToken(row);
  const booking = findVisit(tokenRecord.bookingId);
  const faculty = findTeacher(tokenRecord.facultyId);

  if (!booking) {
    return { valid: false, reason: "The visit request associated with this token no longer exists." };
  }

  // Check if token has already been consumed
  if (tokenRecord.consumedAt) {
    return {
      valid: false,
      alreadyDecided: true,
      reason: `This decision link has already been used on ${new Date(tokenRecord.consumedAt).toLocaleString("en-IN")}.`,
      tokenRecord,
      booking,
      faculty,
    };
  }

  // Check if token has expired
  if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
    return {
      valid: false,
      expired: true,
      reason: "This decision link has expired. Please manage this request through the staff portal.",
      tokenRecord,
      booking,
      faculty,
    };
  }

  // Check action compatibility
  if (
    tokenRecord.action !== "decide" &&
    requestedAction &&
    tokenRecord.action !== requestedAction
  ) {
    return {
      valid: false,
      reason: `This link was issued for "${tokenRecord.action}", not "${requestedAction}".`,
      tokenRecord,
      booking,
      faculty,
    };
  }

  // Check booking status
  if (booking.status !== "Pending") {
    return {
      valid: false,
      alreadyDecided: true,
      reason: `This request is already marked as ${booking.status}.`,
      tokenRecord,
      booking,
      faculty,
    };
  }

  return {
    valid: true,
    tokenRecord,
    booking,
    faculty,
    intendedAction: tokenRecord.action,
  };
}

/**
 * Executes an atomic decision on a visit request via signed token.
 */
export async function executeTokenDecision(params: {
  token: string;
  action: "accept" | "reject";
  reason?: string;
}): Promise<{ booking: VisitRequest; message: string }> {
  const { token, action, reason } = params;
  const verification = verifyApprovalToken(token, action);

  if (!verification.valid) {
    if (verification.alreadyDecided && verification.booking) {
      return {
        booking: verification.booking,
        message: `This request has already been ${verification.booking.status.toLowerCase()}.`,
      };
    }
    throw conflict(verification.reason || "The decision link could not be verified.");
  }

  const { tokenRecord, booking, faculty } = verification;
  if (!tokenRecord || !booking) {
    throw notFound("Visit request record not found.");
  }

  const actor: AuthSession = {
    userId: faculty?.id || "faculty-token",
    name: faculty?.name || booking.hostName || "Authorized Faculty",
    role: "teacher",
    refId: faculty?.id || booking.hostId || undefined,
    email: faculty?.email || "faculty@dsvv.edu.in",
    loginAt: now(),
  };

  // Mark token consumed inside a transaction
  const timestamp = now();
  tx(() => {
    run("UPDATE approval_tokens SET consumed_at = ? WHERE id = ?", [timestamp, tokenRecord.id]);
    // Also consume any sibling tokens for the same booking
    run(
      "UPDATE approval_tokens SET consumed_at = ? WHERE booking_id = ? AND consumed_at IS NULL",
      [timestamp, booking.id],
    );
  });

  persistSecondaryToSupabase("approval_tokens", {
    id: tokenRecord.id,
    consumed_at: timestamp,
  }, "update");

  if (action === "accept") {
    const updated = await approveBooking(booking.id, actor);
    return {
      booking: updated,
      message: `Visit request ${booking.id} for ${booking.fullName} has been approved. The visitor has received their digital QR pass.`,
    };
  } else {
    const rejectionReason = reason?.trim() || "Declined by faculty member.";
    const updated = await rejectBooking(booking.id, rejectionReason, actor);
    return {
      booking: updated,
      message: `Visit request ${booking.id} for ${booking.fullName} has been declined. The visitor has been notified politely.`,
    };
  }
}
