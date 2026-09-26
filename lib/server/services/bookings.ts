import "server-only";

import type { AuthSession, VisitRequest, VisitStatus } from "@/lib/types";
import { HOST_REQUIRED_PURPOSES } from "@/lib/types";
import { fromMinutes, passExpiryFor, toMinutes } from "@/lib/settings";
import { todayISO } from "@/lib/utils";
import { nextBookingRef, nextId, run, toInt, tx } from "../db";
import { audit, notify, type Actor } from "../audit";
import { publish } from "../events";
import { badRequest, conflict, notFound } from "../errors";
import { randomToken } from "../password";
import {
  bookedSlots,
  findAvailability,
  findTeacher,
  findVisit,
  findVisitByIdempotencyKey,
  findVisitorByMobile,
  hasDuplicateBooking,
  listDepartments,
  readSettings,
} from "../repo";
import { sealAadhaar } from "../aadhaar";
import { resolveStoredPhoto } from "../photo-store";
import { PHOTO_MESSAGES } from "@/lib/photo";
import type { BookingInput, GuestInput } from "../validation";
import { notificationService } from "../notification-service";

/**
 * Booking lifecycle.
 *
 * Every mutation runs inside one transaction that covers the booking row, the
 * audit entry and any notification, so the timeline a visitor sees and the
 * record security acts on cannot disagree.
 */

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * Availability
 * ------------------------------------------------------------------ */

export interface SlotOption {
  time: string;
  available: boolean;
  reason?: string;
}

/**
 * Bookable slots for a host on a date.
 *
 * A slot is offered only when it falls inside the host's working pattern,
 * inside campus visiting hours, is not already held by a live booking, and has
 * not already passed today. Returning unavailable slots as well (rather than
 * hiding them) lets the booking form show *why* a time cannot be picked.
 */
export function availableSlots(hostId: string | null, date: string): SlotOption[] {
  const settings = readSettings();
  const windowFrom = toMinutes(settings.visitingHoursFrom);
  const windowTo = toMinutes(settings.visitingHoursTo);

  const availability = hostId ? findAvailability(hostId) : null;
  const slotMinutes = availability?.slotMinutes ?? settings.defaultMeetingMinutes;

  const start = Math.max(windowFrom, availability ? toMinutes(availability.startTime) : windowFrom);
  const end = Math.min(windowTo, availability ? toMinutes(availability.endTime) : windowTo);

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return [];

  // JS getDay() is 0=Sunday; the availability pattern uses ISO 1=Monday..7=Sunday.
  const isoDay = parsed.getDay() === 0 ? 7 : parsed.getDay();

  if (availability) {
    if (!availability.days.includes(isoDay)) return [];
    if (availability.blocked.includes(date)) return [];
  }

  const taken = new Set(hostId ? bookedSlots(hostId, date) : []);
  const isToday = date === todayISO();
  const clock = new Date();
  const minutesNow = clock.getHours() * 60 + clock.getMinutes();

  const slots: SlotOption[] = [];
  for (let m = start; m + slotMinutes <= end; m += slotMinutes) {
    const time = fromMinutes(m);
    if (taken.has(time)) {
      slots.push({ time, available: false, reason: "Already booked" });
    } else if (isToday && m <= minutesNow) {
      slots.push({ time, available: false, reason: "Time has passed" });
    } else {
      slots.push({ time, available: true });
    }
  }
  return slots;
}

/* ------------------------------------------------------------------ *
 * Creation
 * ------------------------------------------------------------------ */

export interface CreateBookingResult {
  booking: VisitRequest;
  /** True when an idempotency key resolved to an existing booking. */
  replayed?: boolean;
}

export interface CreateBookingExtras {
  /** Accompanying visitors, in the order the form collected them. */
  guests?: GuestInput[];
  /**
   * Client-supplied replay guard. A resubmission carrying a key that has
   * already been accepted returns the original booking instead of creating a
   * second one, which is what makes a double-click or a browser retry safe.
   */
  idempotencyKey?: string;
}

/**
 * Creates a booking from the public portal or a staff desk.
 *
 * `actor` is null for the public route — a visitor is not an authenticated
 * principal, so the audit entry records the portal rather than a user.
 */
export function createBooking(
  input: BookingInput,
  actor: Actor = null,
  source: VisitRequest["source"] = "Visitor Portal",
  extras: CreateBookingExtras = {},
): CreateBookingResult {
  const settings = readSettings();
  const guests = extras.guests ?? [];
  const idempotencyKey = extras.idempotencyKey?.trim() || null;

  // Answer a replay before doing any work: the caller gets the booking they
  // already made, and nothing is written twice.
  if (idempotencyKey) {
    const existing = findVisitByIdempotencyKey(idempotencyKey);
    if (existing) return { booking: existing, replayed: true };
  }

  if (guests.length && guests.length !== input.numberOfVisitors - 1) {
    throw badRequest("The visitor details do not match the number of visitors.", {
      numberOfVisitors: "Check how many people are coming.",
    });
  }

  /* --- Policy checks that do not need the write lock ---------------- */

  if (input.numberOfVisitors > settings.maxVisitorsPerBooking) {
    throw badRequest(
      `A single booking may cover at most ${settings.maxVisitorsPerBooking} visitors.`,
      { numberOfVisitors: `Maximum is ${settings.maxVisitorsPerBooking} per booking.` },
    );
  }

  if (!settings.allowedVisitorTypes.includes(input.visitorType)) {
    throw badRequest("That visitor type is not currently accepted.", {
      visitorType: "This visitor type is not accepted right now.",
    });
  }

  const today = todayISO();
  if (input.visitDate < today) {
    throw badRequest("The visit date cannot be in the past.", {
      visitDate: "Choose today or a later date.",
    });
  }
  const horizon = todayISO(settings.advanceBookingDays);
  if (input.visitDate > horizon) {
    throw badRequest(
      `Visits can be booked up to ${settings.advanceBookingDays} days ahead.`,
      { visitDate: `Choose a date on or before ${horizon}.` },
    );
  }

  const minutes = toMinutes(input.visitTime);
  if (minutes < toMinutes(settings.visitingHoursFrom) || minutes >= toMinutes(settings.visitingHoursTo)) {
    throw badRequest(
      `Visiting hours are ${settings.visitingHoursFrom} to ${settings.visitingHoursTo}.`,
      { visitTime: "Choose a time inside visiting hours." },
    );
  }

  if (input.visitDate === today) {
    const clock = new Date();
    if (minutes <= clock.getHours() * 60 + clock.getMinutes()) {
      throw badRequest("That time has already passed today.", {
        visitTime: "Choose a later time.",
      });
    }
  }

  /* --- Photograph -------------------------------------------------- *
   *
   * The id was handed out by the upload endpoint after the bytes were sniffed
   * and written, so this is not re-validating the image — it is confirming the
   * file is still there and turning the id into the storage path the row will
   * carry. A booking is never written with a dangling photo reference.
   */
  const photo = resolveStoredPhoto(input.photoId);
  if (!photo) {
    throw badRequest(PHOTO_MESSAGES.required, { photoId: PHOTO_MESSAGES.required });
  }

  if (settings.requireIdProof && !input.idNumber) {
    throw badRequest("An ID proof is required for campus entry.", {
      idNumber: "ID number is required.",
    });
  }

  if (input.vehicleRequired && settings.requireVehicleDetails && !input.vehicleNumber) {
    throw badRequest("Enter the vehicle number for gate clearance.", {
      vehicleNumber: "Vehicle number is required.",
    });
  }

  /* --- Host resolution --------------------------------------------- */

  const hostId: string | null = input.hostId?.trim() || null;
  let hostName = "";
  let departmentId: string | null = input.departmentId?.trim() || null;
  let department = "";

  if (HOST_REQUIRED_PURPOSES.includes(input.purpose) && !hostId) {
    throw badRequest("Select the person you want to meet.", {
      hostId: "Choose a host for this purpose.",
    });
  }

  if (hostId) {
    const teacher = findTeacher(hostId);
    if (!teacher) throw notFound("That host is no longer listed in the directory.");
    if (!teacher.active) {
      throw badRequest("That host is not accepting visitors at the moment.", {
        hostId: "Choose another host.",
      });
    }
    hostName = teacher.name;
    departmentId = teacher.departmentId || departmentId;
    department = teacher.department;

    const slot = availableSlots(hostId, input.visitDate).find((s) => s.time === input.visitTime);
    if (!slot) {
      throw badRequest("That time is outside the host's available hours.", {
        visitTime: "Pick one of the offered slots.",
      });
    }
    if (!slot.available) {
      // A visitor resubmitting the same form occupies the slot themselves.
      // Telling them to pick another time would be misleading, so name the
      // real reason first. The authoritative duplicate check still runs inside
      // the write transaction below; this one only improves the message.
      const self = findVisitorByMobile(input.mobile);
      if (self && hasDuplicateBooking(self.id, input.visitDate, input.visitTime, hostId)) {
        throw conflict("A booking already exists for this visitor and time.");
      }
      throw conflict(
        slot.reason === "Already booked"
          ? "That time slot has just been taken. Please choose another one."
          : "That time has already passed today.",
      );
    }
  }

  if (!department && departmentId) {
    department = listDepartments().find((d) => d.id === departmentId)?.name ?? "";
  }
  if (!hostName) hostName = department ? `${department} Desk` : "Front Desk";

  /* --- Write ------------------------------------------------------- */

  // The WhatsApp contact defaults to the mobile the visitor already gave, so a
  // booking taken at the desk still has somewhere to send the pass.
  const whatsappCountryCode = input.whatsappCountryCode || "+91";
  const whatsappNumber = input.whatsappNumber || input.mobile;

  const booking = tx(() => {
    const timestamp = now();
    const existing = findVisitorByMobile(input.mobile);

    let visitorId: string;
    if (existing) {
      if (existing.blacklisted) {
        throw conflict(
          "This visitor cannot be booked online. Please contact the security desk.",
        );
      }
      visitorId = existing.id;
      // A returning visitor's photograph is refreshed to the one taken for this
      // visit: the gate matches a face against the current booking, so the
      // newest image is the useful one on the visitor record.
      //
      // The file it supersedes is deliberately *not* deleted. Every previous
      // booking still carries its own `photo_url`, and the photograph on a
      // completed visit is part of that visit's record — removing the bytes
      // would blank out the gate history that referenced them.
      run(
        `UPDATE visitors SET full_name = ?, email = ?, gender = ?, id_type = ?, id_number = ?,
            photo_url = ?, organization = ?, address = ?, emergency_contact = ?,
            whatsapp_country_code = ?, whatsapp_number = ?, visitor_type = ?,
            total_visits = total_visits + 1, updated_at = ?
          WHERE id = ?`,
        [
          input.fullName,
          input.email || existing.email,
          input.gender,
          input.idType,
          input.idNumber,
          photo.path,
          input.organization || existing.organization,
          input.address || existing.address,
          input.emergencyContact || existing.emergencyContact,
          whatsappCountryCode,
          whatsappNumber,
          input.visitorType,
          timestamp,
          visitorId,
        ],
      );
    } else {
      visitorId = nextId("VSTR");
      run(
        `INSERT INTO visitors
           (id, full_name, mobile, email, gender, id_type, id_number, photo_url, organization, address,
            emergency_contact, whatsapp_country_code, whatsapp_number,
            visitor_type, total_visits, blacklisted, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?)`,
        [
          visitorId,
          input.fullName,
          input.mobile,
          input.email,
          input.gender,
          input.idType,
          input.idNumber,
          photo.path,
          input.organization,
          input.address,
          input.emergencyContact,
          whatsappCountryCode,
          whatsappNumber,
          input.visitorType,
          timestamp,
          timestamp,
        ],
      );
    }

    if (hasDuplicateBooking(visitorId, input.visitDate, input.visitTime, hostId)) {
      throw conflict("A booking already exists for this visitor and time.");
    }

    const id = nextBookingRef();
    run(
      `INSERT INTO visit_requests
         (id, visitor_id, full_name, mobile, email, gender, organization, address, emergency_contact,
          whatsapp_country_code, whatsapp_number,
          visitor_type, id_type, id_number, photo_url, purpose, purpose_detail, host_id, host_name,
          department_id, department, visit_date, visit_time, expected_duration, number_of_visitors,
          vehicle_required, vehicle_number, notes, special_requirements, status, source,
          pass_token, pass_expires_at, idempotency_key, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Pending',?,?,?,?,?,?)`,
      [
        id,
        visitorId,
        input.fullName,
        input.mobile,
        input.email,
        input.gender,
        input.organization,
        input.address,
        input.emergencyContact,
        whatsappCountryCode,
        whatsappNumber,
        input.visitorType,
        input.idType,
        input.idNumber,
        photo.path,
        input.purpose,
        input.purposeDetail ?? null,
        hostId,
        hostName,
        departmentId,
        department,
        input.visitDate,
        input.visitTime,
        input.expectedDuration,
        input.numberOfVisitors,
        toInt(input.vehicleRequired),
        input.vehicleNumber ?? null,
        input.notes ?? null,
        input.specialRequirements ?? null,
        source,
        // Issued now, not on approval: the visitor leaves with a working QR
        // code, and scanning it before approval reports the real status.
        randomToken(24),
        passExpiryFor(input.visitDate, input.visitTime, settings.autoExpireHours),
        idempotencyKey,
        timestamp,
        timestamp,
      ],
    );

    // Accompanying visitors belong to the same transaction as the booking —
    // a half-written party is never visible to the gate.
    guests.forEach((guest, index) => {
      const sealed = sealAadhaar(guest.aadhaar);
      run(
        `INSERT INTO visit_guests
           (id, booking_id, position, full_name, mobile, aadhaar_ciphertext, aadhaar_hash,
            aadhaar_last4, relation, address, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          nextId("GST"),
          id,
          index + 2, // the primary visitor is 1
          guest.fullName,
          guest.mobile,
          sealed.ciphertext,
          sealed.hash,
          sealed.last4,
          guest.relation,
          guest.address,
          timestamp,
          timestamp,
        ],
      );
    });

    if (settings.notifyRequests) {
      notify({
        type: "request",
        title: "New visit request",
        message: `${input.fullName} requested a visit with ${hostName} on ${input.visitDate} at ${input.visitTime}.`,
        href: "/admin/requests",
      });
    }

    audit(actor, {
      action: "booking.created",
      entity: "booking",
      entityId: id,
      summary: `Booking ${id} created for ${input.fullName} with ${hostName} on ${input.visitDate} at ${input.visitTime}.`,
      channel: actor ? "web" : "visitor-portal",
    });

    const created = findVisit(id);
    if (!created) throw badRequest("The booking could not be saved. Please try again.");
    return created;
  });

  publish("bookings", "created", booking.id);
  notificationService.sendBookingConfirmation(booking);

  // The host is told over WhatsApp, from the campus business number, as soon
  // as the booking exists. Detached inside the service — a messaging outage
  // must not fail a booking that is already committed.
  if (booking.hostId) {
    const host = findTeacher(booking.hostId);
    if (host) notificationService.sendFacultyVisitRequest(booking, host);
  }

  return { booking };
}

/* ------------------------------------------------------------------ *
 * Decisions
 * ------------------------------------------------------------------ */

function requireBooking(id: string): VisitRequest {
  const booking = findVisit(id);
  if (!booking) throw notFound("No booking found for that reference.");
  return booking;
}

const DECIDABLE: VisitStatus[] = ["Pending", "Rescheduled"];

export function approveBooking(id: string, actor: AuthSession): VisitRequest {
  const current = requireBooking(id);
  if (current.status === "Approved") return current;
  if (!DECIDABLE.includes(current.status)) {
    throw conflict(`A booking that is ${current.status.toLowerCase()} can no longer be approved.`);
  }

  const updated = tx(() => {
    const timestamp = now();
    const badge = nextId("B", { pad: 3, template: (serial) => `B-${serial}` });
    run(
      `UPDATE visit_requests
          SET status = 'Approved', decided_at = ?, decided_by = ?, rejection_reason = NULL,
              badge_number = COALESCE(badge_number, ?), pass_token = COALESCE(pass_token, ?),
              pass_expires_at = COALESCE(pass_expires_at, ?), updated_at = ?
        WHERE id = ?`,
      [
        timestamp,
        actor.name,
        badge,
        randomToken(24),
        // Backfills the window for bookings taken before passes carried one.
        passExpiryFor(current.visitDate, current.visitTime, readSettings().autoExpireHours),
        timestamp,
        current.id,
      ],
    );

    notify({
      type: "approval",
      title: "Visit approved",
      message: `${current.fullName}'s visit ${current.id} was approved. Visitor pass issued.`,
      href: `/admin/bookings?q=${encodeURIComponent(current.id)}`,
    });

    audit(actor, {
      action: "booking.approved",
      entity: "booking",
      entityId: current.id,
      summary: `${actor.name} approved booking ${current.id} for ${current.fullName}.`,
    });

    return requireBooking(current.id);
  });

  publish("bookings", "approved", updated.id);
  notificationService.sendApproval(updated);
  return updated;
}

export function rejectBooking(id: string, reason: string, actor: AuthSession): VisitRequest {
  const current = requireBooking(id);
  if (!DECIDABLE.includes(current.status) && current.status !== "Approved") {
    throw conflict(`A booking that is ${current.status.toLowerCase()} can no longer be rejected.`);
  }

  const updated = tx(() => {
    const timestamp = now();
    run(
      `UPDATE visit_requests
          SET status = 'Rejected', decided_at = ?, decided_by = ?, rejection_reason = ?, updated_at = ?
        WHERE id = ?`,
      [timestamp, actor.name, reason, timestamp, current.id],
    );

    notify({
      type: "rejection",
      title: "Visit rejected",
      message: `${current.fullName}'s visit ${current.id} was rejected — ${reason}`,
      href: "/admin/requests",
    });

    audit(actor, {
      action: "booking.rejected",
      entity: "booking",
      entityId: current.id,
      summary: `${actor.name} rejected booking ${current.id} — ${reason}`,
    });

    return requireBooking(current.id);
  });

  publish("bookings", "rejected", updated.id);
  notificationService.sendRejection(updated, reason);
  return updated;
}

/**
 * Moves a booking to a new slot.
 *
 * The booking returns to `Rescheduled` — a visitor should not treat a moved
 * appointment as confirmed until the host has accepted the new time.
 */
export function rescheduleBooking(
  id: string,
  visitDate: string,
  visitTime: string,
  actor: AuthSession,
): VisitRequest {
  const current = requireBooking(id);
  if (["Checked Out", "Cancelled", "Rejected", "Expired"].includes(current.status)) {
    throw conflict(`A booking that is ${current.status.toLowerCase()} can no longer be moved.`);
  }
  if (visitDate < todayISO()) {
    throw badRequest("The new date cannot be in the past.", {
      visitDate: "Choose today or a later date.",
    });
  }

  if (current.hostId) {
    const slot = availableSlots(current.hostId, visitDate).find((s) => s.time === visitTime);
    if (!slot) {
      throw badRequest("That time is outside the host's available hours.", {
        visitTime: "Pick an offered slot.",
      });
    }
    if (!slot.available && !(visitDate === current.visitDate && visitTime === current.visitTime)) {
      throw conflict("That time slot is already taken. Please choose another one.");
    }
  }

  const updated = tx(() => {
    const timestamp = now();
    run(
      `UPDATE visit_requests
          SET visit_date = ?, visit_time = ?, status = 'Rescheduled',
              rescheduled_from = ?, decided_at = NULL, decided_by = NULL,
              pass_expires_at = ?, updated_at = ?
        WHERE id = ?`,
      [
        visitDate,
        visitTime,
        `${current.visitDate} ${current.visitTime}`,
        // The pass follows the slot it was moved to.
        passExpiryFor(visitDate, visitTime, readSettings().autoExpireHours),
        timestamp,
        current.id,
      ],
    );

    notify({
      type: "meeting",
      title: "Meeting rescheduled",
      message: `${current.fullName}'s meeting moved to ${visitDate} at ${visitTime}.`,
      href: "/admin/meetings",
    });

    audit(actor, {
      action: "booking.rescheduled",
      entity: "booking",
      entityId: current.id,
      summary: `${actor.name} moved booking ${current.id} from ${current.visitDate} ${current.visitTime} to ${visitDate} ${visitTime}.`,
    });

    return requireBooking(current.id);
  });

  publish("bookings", "rescheduled", updated.id);
  notificationService.sendReschedule(updated);
  return updated;
}

export function cancelBooking(id: string, actor: Actor, reason?: string): VisitRequest {
  const current = requireBooking(id);
  if (["Checked Out", "Cancelled"].includes(current.status)) {
    throw conflict("That booking is already closed.");
  }
  if (current.status === "Checked In" || current.status === "Meeting In Progress") {
    throw conflict("The visitor is inside the campus — check them out instead of cancelling.");
  }

  const updated = tx(() => {
    const timestamp = now();
    run(
      `UPDATE visit_requests
          SET status = 'Cancelled', decided_at = ?, rejection_reason = COALESCE(?, rejection_reason), updated_at = ?
        WHERE id = ?`,
      [timestamp, reason ?? null, timestamp, current.id],
    );
    audit(actor, {
      action: "booking.cancelled",
      entity: "booking",
      entityId: current.id,
      summary: `Booking ${current.id} for ${current.fullName} was cancelled.`,
    });
    return requireBooking(current.id);
  });

  publish("bookings", "cancelled", updated.id);
  return updated;
}

export function markNoShow(id: string, actor: AuthSession): VisitRequest {
  const current = requireBooking(id);
  if (current.status !== "Approved" && current.status !== "Rescheduled") {
    throw conflict("Only an approved booking can be marked as a no-show.");
  }

  const updated = tx(() => {
    const timestamp = now();
    run("UPDATE visit_requests SET status = 'No Show', updated_at = ? WHERE id = ?", [
      timestamp,
      current.id,
    ]);
    audit(actor, {
      action: "booking.no_show",
      entity: "booking",
      entityId: current.id,
      summary: `${actor.name} marked booking ${current.id} as a no-show.`,
    });
    return requireBooking(current.id);
  });

  publish("bookings", "no-show", updated.id);
  return updated;
}

/* ------------------------------------------------------------------ *
 * Meeting progress
 * ------------------------------------------------------------------ */

export function startMeeting(id: string, actor: AuthSession): VisitRequest {
  const current = requireBooking(id);
  if (current.status === "Meeting In Progress") return current;
  if (current.status !== "Checked In") {
    throw conflict("The visitor must be checked in before the meeting can start.");
  }

  const updated = tx(() => {
    const timestamp = now();
    run(
      "UPDATE visit_requests SET status = 'Meeting In Progress', meeting_started_at = ?, updated_at = ? WHERE id = ?",
      [timestamp, timestamp, current.id],
    );
    audit(actor, {
      action: "meeting.started",
      entity: "booking",
      entityId: current.id,
      summary: `Meeting started between ${current.fullName} and ${current.hostName}.`,
    });
    return requireBooking(current.id);
  });

  publish("meetings", "started", updated.id);
  notificationService.sendMeetingStarted(updated);
  return updated;
}

export function completeMeeting(id: string, actor: AuthSession): VisitRequest {
  const current = requireBooking(id);
  if (!["Checked In", "Meeting In Progress"].includes(current.status)) {
    throw conflict("Only a meeting that is under way can be completed.");
  }

  const updated = tx(() => {
    const timestamp = now();
    run(
      `UPDATE visit_requests
          SET status = 'Checked In', meeting_started_at = COALESCE(meeting_started_at, ?),
              meeting_ended_at = ?, updated_at = ?
        WHERE id = ?`,
      [timestamp, timestamp, timestamp, current.id],
    );
    audit(actor, {
      action: "meeting.completed",
      entity: "booking",
      entityId: current.id,
      summary: `${actor.name} marked the meeting with ${current.fullName} complete. Awaiting gate check-out.`,
    });
    return requireBooking(current.id);
  });

  publish("meetings", "completed", updated.id);
  notificationService.sendMeetingCompleted(updated);
  return updated;
}

/* ------------------------------------------------------------------ *
 * Housekeeping
 * ------------------------------------------------------------------ */

/**
 * Expires bookings whose slot has long passed without anyone arriving.
 *
 * Run opportunistically when the dashboard snapshot is read: it keeps
 * "Pending" from accumulating stale rows without needing a scheduler.
 */
export function expireStaleBookings(): number {
  const settings = readSettings();
  const cutoff = new Date(Date.now() - settings.autoExpireHours * 3600_000);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const changed = tx(() => {
    const result = run(
      `UPDATE visit_requests
          SET status = 'Expired', updated_at = ?
        WHERE status IN ('Pending','Rescheduled','Approved')
          AND visit_date < ?`,
      [now(), cutoffDate],
    );
    if (result.changes > 0) {
      audit(null, {
        action: "booking.expired",
        entity: "booking",
        entityId: "batch",
        summary: `${result.changes} booking(s) past their visit date were expired automatically.`,
        channel: "scheduler",
      });
    }
    return result.changes;
  });

  if (changed > 0) publish("bookings", "expired");
  return changed;
}
