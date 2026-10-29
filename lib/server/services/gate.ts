import "server-only";

import type { AuthSession, SecurityGuard, VisitRequest } from "@/lib/types";
import { toMinutes } from "@/lib/settings";
import { todayInCampusTz, campusMinutesNow } from "@/lib/utils";
import { nextId, run, tx } from "../db";
import { audit, notify } from "../audit";
import { publish } from "../events";
import { AppError, conflict, notFound } from "../errors";
import {
  findGuard,
  findVisit,
  findVisitByToken,
  findVehicleInside,
  readSettings,
} from "../repo";
import { all } from "../db";
import { mapVisit } from "../repo";
import { notificationService } from "../notification-service";
import { isSupabaseConfigured } from "@/lib/supabase";
import { persistSecondaryToSupabase, persistToSupabase } from "../supabase-db";

/**
 * Gate operations.
 *
 * The pass QR carries an opaque token and nothing else. It is not a credential
 * and is not trusted: the token is only a lookup key, and every entry decision
 * below is taken from the booking row the server reads back. A forged or
 * replayed QR therefore cannot get anyone through the gate — the worst it can
 * do is point at a booking that then fails these checks.
 */

const now = () => new Date().toISOString();

export interface VerificationIssue {
  code: string;
  message: string;
}

export interface CheckLogEntry {
  id: string;
  visitRequestId?: string;
  visitorId?: string;
  visitorName?: string;
  direction: "In" | "Out";
  gate: string;
  guardName: string;
  guardId?: string;
  at: string;
  note?: string | null;
}

export interface VerificationResult {
  ok: boolean;
  booking?: VisitRequest;
  issues: VerificationIssue[];
  /** What the guard is expected to do next when `ok` is true. */
  nextAction?: "check-in" | "check-out";
  history?: CheckLogEntry[];
}

/* ------------------------------------------------------------------ *
 * Verification
 * ------------------------------------------------------------------ */

/** Resolves whatever the gate presented — QR token, reference or mobile. */
function resolveBooking(input: {
  token?: string;
  bookingId?: string;
  mobile?: string;
}): VisitRequest | undefined {
  if (input.token) {
    let rawToken = input.token.trim();
    // Parse URL if visitor scanned a pass link
    try {
      if (rawToken.startsWith("http://") || rawToken.startsWith("https://")) {
        const url = new URL(rawToken);
        const parts = url.pathname.split("/").filter(Boolean);
        const lastPart = parts[parts.length - 1];
        if (lastPart) rawToken = decodeURIComponent(lastPart);
      }
    } catch {
      // ignore URL parsing error and use raw string
    }

    const byToken = findVisitByToken(rawToken);
    if (byToken) return byToken;
    // Older passes and hand-typed scans may carry the plain reference.
    const byRef = findVisit(rawToken);
    if (byRef) return byRef;
  }
  if (input.bookingId) {
    const byRef = findVisit(input.bookingId.trim());
    if (byRef) return byRef;
  }
  if (input.mobile) {
    const digits = input.mobile.replace(/[\s-]/g, "");
    const rows = all(
      `SELECT * FROM visit_requests
        WHERE mobile = ?
          AND status IN ('Approved','Rescheduled','Pending','Checked In','Meeting In Progress')
        ORDER BY CASE status WHEN 'Checked In' THEN 0 WHEN 'Meeting In Progress' THEN 0
                             WHEN 'Approved' THEN 1 ELSE 2 END,
                 visit_date ASC, visit_time ASC
        LIMIT 1`,
      [digits],
    );
    if (rows.length) return mapVisit(rows[0]);
  }
  return undefined;
}

/**
 * Runs every entry rule and reports all failures at once, so a guard sees the
 * full picture rather than fixing one problem to discover the next.
 */
export function verifyPass(input: {
  token?: string;
  bookingId?: string;
  mobile?: string;
}): VerificationResult {
  const booking = resolveBooking(input);
  if (!booking) {
    return {
      ok: false,
      issues: [{ code: "not_found", message: "No booking found for that pass or reference." }],
    };
  }

  const historyRows = (all(
    `SELECT id, visit_request_id as visitRequestId, visitor_id as visitorId, visitor_name as visitorName,
            direction, gate, guard_id as guardId, guard_name as guardName, note, at
       FROM check_logs
      WHERE visit_request_id = ? OR visitor_id = ?
      ORDER BY at DESC LIMIT 10`,
    [booking.id, booking.visitorId],
  ) as unknown as CheckLogEntry[]) ?? [];

  const issues: VerificationIssue[] = [];
  const today = todayInCampusTz();

  if (booking.status === "Checked In" || booking.status === "Meeting In Progress") {
    return { ok: true, booking, issues: [], nextAction: "check-out", history: historyRows };
  }

  switch (booking.status) {
    case "Approved":
      break;
    case "Pending":
    case "Rescheduled":
      issues.push({
        code: "not_approved",
        message: "This booking is still awaiting approval — entry cannot be granted.",
      });
      break;
    case "Rejected":
      issues.push({ code: "rejected", message: "This booking was rejected." });
      break;
    case "Cancelled":
      issues.push({ code: "cancelled", message: "This booking was cancelled." });
      break;
    case "Checked Out":
      issues.push({ code: "used", message: "This pass has already been used and closed." });
      break;
    case "No Show":
      issues.push({ code: "no_show", message: "This booking was closed as a no-show." });
      break;
    case "Expired":
      issues.push({ code: "expired", message: "This pass has expired." });
      break;
  }

  // A pass stops being admissible once its window closes, whatever the row
  // still says — a screenshot of a valid QR is worth nothing after this point.
  if (booking.passExpiresAt && Date.parse(booking.passExpiresAt) < Date.now()) {
    issues.push({
      code: "expired",
      message: "This pass has expired and can no longer be used for entry.",
    });
  }

  const vDate = booking.visitDate || today;
  if (vDate > today) {
    issues.push({
      code: "too_early",
      message: `This pass is valid on ${vDate}, not today.`,
    });
  }
  if (vDate < today) {
    issues.push({
      code: "date_passed",
      message: `This pass was valid on ${vDate} and is no longer current.`,
    });
  }

  if (vDate === today) {
    const settings = readSettings();
    // Use campus IST clock for visiting hours comparison.
    const minutes = campusMinutesNow();
    // Compare whole minutes, not just the hour: truncating to the hour would
    // close a 23:59 gate at 23:00, and open an 07:30 gate half an hour early.
    const from = toMinutes(settings.visitingHoursFrom);
    const to = toMinutes(settings.visitingHoursTo);
    if (minutes < from || minutes >= to) {
      issues.push({
        code: "outside_hours",
        message: `Campus visiting hours are ${settings.visitingHoursFrom} to ${settings.visitingHoursTo}.`,
      });
    }
  }

  return issues.length
    ? { ok: false, booking, issues, history: historyRows }
    : { ok: true, booking, issues: [], nextAction: "check-in", history: historyRows };
}

/* ------------------------------------------------------------------ *
 * Check-in / check-out
 * ------------------------------------------------------------------ */

/** The guard record behind the signed-in account, when there is one. */
function actingGuard(actor: AuthSession): SecurityGuard | undefined {
  return actor.refId ? findGuard(actor.refId) : undefined;
}

export interface GateResult {
  booking: VisitRequest;
  guardName: string;
  gate: string;
}

export async function checkIn(
  bookingId: string,
  gate: string,
  actor: AuthSession,
  note?: string,
): Promise<GateResult> {
  const verification = verifyPass({ bookingId });
  if (!verification.booking) throw notFound("No booking found for that reference.");
  if (verification.booking.status === "Checked In" || verification.booking.status === "Meeting In Progress") {
    throw conflict("This visitor is already inside the campus.");
  }
  if (!verification.ok) {
    throw conflict(verification.issues[0]?.message ?? "This pass cannot be accepted at the gate.");
  }

  const guard = actingGuard(actor);
  const guardName = guard?.fullName ?? actor.name;
  const booking = verification.booking;
  const chkId = nextId("CHK");
  const timestamp = now();

  const updated = tx(() => {
    run(
      `UPDATE visit_requests
          SET status = 'Checked In', check_in_at = ?, checked_in_by = ?, gate = ?, updated_at = ?
        WHERE id = ?`,
      [timestamp, guardName, gate, timestamp, booking.id],
    );

    // The unique index on (visit_request_id, direction) makes a double-tap a
    // constraint violation rather than a second log line.
    run(
      `INSERT INTO check_logs
         (id, visit_request_id, visitor_id, visitor_name, direction, gate, guard_id, guard_name, note, at)
       VALUES (?,?,?,?,'In',?,?,?,?,?)`,
      [
        chkId,
        booking.id,
        booking.visitorId,
        booking.fullName,
        gate,
        guard?.id ?? null,
        guardName,
        note ?? null,
        timestamp,
      ],
    );

    run(
      `INSERT INTO movements(id, person_id, person_name, person_type, direction, gate, at)
       VALUES (?,?,?,'Visitor','Entry',?,?)`,
      [nextId("MOV"), booking.visitorId, booking.fullName, gate, timestamp],
    );

    // A booking that declared a vehicle opens a vehicle record at the same time.
    if (booking.vehicleRequired && booking.vehicleNumber) {
      const plate = booking.vehicleNumber.replace(/[\s-]/g, "").toUpperCase();
      if (!findVehicleInside(plate)) {
        run(
          `INSERT INTO vehicles
             (id, vehicle_number, vehicle_type, visitor_name, driver_name, purpose, gate,
              entry_time, status, linked_visit_id, guard_id, guard_name)
           VALUES (?,?,'Car',?,?,?,?,?,'Inside',?,?,?)`,
          [
            nextId("VEH"),
            plate,
            booking.fullName,
            booking.fullName,
            booking.purposeDetail || booking.purpose || "Campus Visit",
            gate,
            timestamp,
            booking.id,
            guard?.id ?? null,
            guardName,
          ],
        );
      }
    }

    const settings = readSettings();
    if (settings.notifyGate) {
      notify({
        type: "checkin",
        title: "Visitor checked in",
        message: `${booking.fullName} checked in at ${gate} by ${guardName}.`,
        href: "/admin/checkin",
      });
    }

    audit(actor, {
      action: "gate.check_in",
      entity: "booking",
      entityId: booking.id,
      summary: `Guard ${guardName} checked in visitor ${booking.fullName} at ${gate}.`,
    });

    const after = findVisit(booking.id);
    if (!after) throw notFound("The booking disappeared during check-in.");
    return after;
  });

  publish("gate", "checked-in", updated.id);
  notificationService.sendCheckIn(updated);

  // Sync entry to Supabase
  if (isSupabaseConfigured()) {
    try {
      await persistToSupabase("visit_requests", {
        id: updated.id,
        status: updated.status,
        check_in_at: updated.checkInAt,
        checked_in_by: updated.checkedInBy,
        gate: updated.gate,
        updated_at: updated.updatedAt,
      }, "update");
    } catch (err) {
      console.error(`[gate] Supabase persistence failed for checkIn ${updated.id}:`, err);
      throw new AppError("Failed to record check-in in database.", 500, "database_persistence_failed");
    }
  }

  persistSecondaryToSupabase("check_logs", {
    id: chkId,
    visit_request_id: booking.id,
    visitor_id: booking.visitorId,
    visitor_name: booking.fullName,
    direction: "In",
    gate,
    guard_id: guard?.id ?? null,
    guard_name: guardName,
    note: note ?? null,
    at: timestamp,
  });

  return { booking: updated, guardName, gate };
}

export async function checkOut(
  bookingId: string,
  gate: string,
  actor: AuthSession,
  note?: string,
): Promise<GateResult> {
  const booking = findVisit(bookingId);
  if (!booking) throw notFound("No booking found for that reference.");
  if (booking.status === "Checked Out") {
    throw conflict("This visitor has already been checked out.");
  }
  if (booking.status !== "Checked In" && booking.status !== "Meeting In Progress") {
    throw conflict("This visitor is not currently inside the campus.");
  }

  const guard = actingGuard(actor);
  const guardName = guard?.fullName ?? actor.name;
  const chkId = nextId("CHK");
  const timestamp = now();

  const updated = tx(() => {
    run(
      `UPDATE visit_requests
          SET status = 'Checked Out', check_out_at = ?, checked_out_by = ?,
              meeting_ended_at = COALESCE(meeting_ended_at, ?), updated_at = ?
        WHERE id = ?`,
      [timestamp, guardName, timestamp, timestamp, booking.id],
    );

    run(
      `INSERT INTO check_logs
         (id, visit_request_id, visitor_id, visitor_name, direction, gate, guard_id, guard_name, note, at)
       VALUES (?,?,?,?,'Out',?,?,?,?,?)`,
      [
        chkId,
        booking.id,
        booking.visitorId,
        booking.fullName,
        gate,
        guard?.id ?? null,
        guardName,
        note ?? null,
        timestamp,
      ],
    );

    run(
      `INSERT INTO movements(id, person_id, person_name, person_type, direction, gate, at)
       VALUES (?,?,?,'Visitor','Exit',?,?)`,
      [nextId("MOV"), booking.visitorId, booking.fullName, gate, timestamp],
    );

    // Close any vehicle that came in against this booking.
    run(
      "UPDATE vehicles SET status = 'Exited', exit_time = ? WHERE linked_visit_id = ? AND status = 'Inside'",
      [timestamp, booking.id],
    );

    const settings = readSettings();
    if (settings.notifyGate) {
      notify({
        type: "checkout",
        title: "Visitor checked out",
        message: `${booking.fullName} checked out at ${gate} by ${guardName}.`,
        href: "/admin/visitors",
      });
    }

    audit(actor, {
      action: "gate.check_out",
      entity: "booking",
      entityId: booking.id,
      summary: `Guard ${guardName} checked out visitor ${booking.fullName} at ${gate}.`,
    });

    const after = findVisit(booking.id);
    if (!after) throw notFound("The booking disappeared during check-out.");
    return after;
  });

  publish("gate", "checked-out", updated.id);
  notificationService.sendCheckOut(updated);

  // Sync exit to Supabase
  if (isSupabaseConfigured()) {
    try {
      await persistToSupabase("visit_requests", {
        id: updated.id,
        status: updated.status,
        check_out_at: updated.checkOutAt,
        checked_out_by: updated.checkedOutBy,
        updated_at: updated.updatedAt,
      }, "update");
    } catch (err) {
      console.error(`[gate] Supabase persistence failed for checkOut ${updated.id}:`, err);
      throw new AppError("Failed to record check-out in database.", 500, "database_persistence_failed");
    }
  }

  persistSecondaryToSupabase("check_logs", {
    id: chkId,
    visit_request_id: booking.id,
    visitor_id: booking.visitorId,
    visitor_name: booking.fullName,
    direction: "Out",
    gate,
    guard_id: guard?.id ?? null,
    guard_name: guardName,
    note: note ?? null,
    at: timestamp,
  });

  return { booking: updated, guardName, gate };
}
