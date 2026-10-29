import "server-only";

import * as crypto from "crypto";
import type {
  AuthSession,
  Hostel,
  HostelMembership,
  OutpassRequest,
  OutpassStatus,
  StudentGateEvent,
  StudentPass,
  StudentPassState,
} from "@/lib/types";
import { all, get, nextId, run, tx, type SqlValue } from "../db";
import type { Row } from "../db";
import { audit, notify } from "../audit";
import { publish } from "../events";
import { badRequest, conflict, forbidden, notFound } from "../errors";

/**
 * Student Outpass & Digital Pass Service.
 *
 * Workflow:
 *   Student submits → PENDING (no pass issued)
 *   Warden approves → APPROVED → pass generated (one-time, secure token)
 *   Warden rejects  → REJECTED (no pass)
 *   Guard scans at exit → student_gate_events (EXIT)
 *   Guard scans at entry → student_gate_events (ENTRY); pass becomes RETURNED
 *
 * Security:
 *   - Pass token is random (crypto.randomBytes); only SHA-256 hash stored in DB
 *   - Token is returned only to the student at pass-creation time
 *   - Duplicate exit/entry blocked by unique index (unless override)
 *   - Only authorized warden (approver_id match) can approve/reject
 */

const now = () => new Date().toISOString();
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/* ------------------------------------------------------------------ *
 * Row mappers
 * ------------------------------------------------------------------ */

function mapHostel(r: Row): Hostel {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: String(r.kind || "Hostel") as Hostel["kind"],
    gender: String(r.gender || "Mixed") as Hostel["gender"],
    capacity: r.capacity != null ? Number(r.capacity) : null,
    wardenId: r.warden_id ? String(r.warden_id) : null,
    wardenName: String(r.warden_name || ""),
    active: Boolean(r.active),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapMembership(r: Row): HostelMembership {
  return {
    id: String(r.id),
    studentId: String(r.student_id),
    hostelId: String(r.hostel_id),
    hostelName: r.hostel_name ? String(r.hostel_name) : undefined,
    roomNumber: String(r.room_number || ""),
    approverId: r.approver_id ? String(r.approver_id) : null,
    approverName: String(r.approver_name || ""),
    active: Boolean(r.active),
    assignedAt: String(r.assigned_at),
    assignedBy: String(r.assigned_by),
    notes: r.notes ? String(r.notes) : null,
  };
}

function mapOutpass(r: Row): OutpassRequest {
  return {
    id: String(r.id),
    studentId: String(r.student_id),
    studentName: String(r.student_name),
    studentRoll: String(r.student_roll),
    hostelId: r.hostel_id ? String(r.hostel_id) : null,
    hostelName: String(r.hostel_name || ""),
    purpose: String(r.purpose),
    destination: String(r.destination || ""),
    emergencyContact: String(r.emergency_contact || ""),
    departureAt: String(r.departure_at),
    expectedReturnAt: r.expected_return_at ? String(r.expected_return_at) : null,
    notes: r.notes ? String(r.notes) : null,
    approverId: r.approver_id ? String(r.approver_id) : null,
    approverName: String(r.approver_name || ""),
    status: String(r.status) as OutpassStatus,
    decidedAt: r.decided_at ? String(r.decided_at) : null,
    decidedBy: r.decided_by ? String(r.decided_by) : null,
    rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
    extendedReturnAt: r.extended_return_at ? String(r.extended_return_at) : null,
    extensionNote: r.extension_note ? String(r.extension_note) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapPass(r: Row, includeToken?: string): StudentPass {
  return {
    id: String(r.id),
    outpassId: String(r.outpass_id),
    studentId: String(r.student_id),
    studentName: String(r.student_name),
    passToken: includeToken,
    validFrom: String(r.valid_from),
    validUntil: String(r.valid_until),
    state: String(r.state) as StudentPassState,
    issuedBy: String(r.issued_by || "system"),
    issuedAt: String(r.issued_at),
    cancelledBy: r.cancelled_by ? String(r.cancelled_by) : null,
    cancelledAt: r.cancelled_at ? String(r.cancelled_at) : null,
    cancellationNote: r.cancellation_note ? String(r.cancellation_note) : null,
    lateReturn: Boolean(r.late_return),
    lateAlertSent: Boolean(r.late_alert_sent),
  };
}

function mapGateEvent(r: Row): StudentGateEvent {
  return {
    id: String(r.id),
    passId: String(r.pass_id),
    outpassId: String(r.outpass_id),
    studentId: String(r.student_id),
    studentName: String(r.student_name),
    direction: String(r.direction) as "EXIT" | "ENTRY",
    gate: String(r.gate),
    scannedBy: r.scanned_by ? String(r.scanned_by) : null,
    scannedByName: String(r.scanned_by_name || ""),
    note: r.note ? String(r.note) : null,
    isOverride: Boolean(r.is_override),
    overrideBy: r.override_by ? String(r.override_by) : null,
    overrideNote: r.override_note ? String(r.override_note) : null,
    at: String(r.at),
  };
}

/* ------------------------------------------------------------------ *
 * Hostel finders
 * ------------------------------------------------------------------ */

export function listHostels(activeOnly = true): Hostel[] {
  const rows = all<Row>(
    activeOnly
      ? "SELECT * FROM hostels WHERE active = 1 ORDER BY name"
      : "SELECT * FROM hostels ORDER BY name",
  );
  return rows.map(mapHostel);
}

export function findHostel(id: string): Hostel | null {
  const r = get<Row>("SELECT * FROM hostels WHERE id = ?", [id]);
  return r ? mapHostel(r) : null;
}

export function getStudentMembership(studentId: string): HostelMembership | null {
  const r = get<Row>(
    `SELECT hm.*, h.name as hostel_name
     FROM hostel_memberships hm
     LEFT JOIN hostels h ON h.id = hm.hostel_id
     WHERE hm.student_id = ? AND hm.active = 1`,
    [studentId],
  );
  return r ? mapMembership(r) : null;
}

/* ------------------------------------------------------------------ *
 * Hostel CRUD (admin only)
 * ------------------------------------------------------------------ */

export function createHostel(
  data: { name: string; kind: Hostel["kind"]; gender: Hostel["gender"]; capacity?: number; wardenId?: string; wardenName?: string; notes?: string },
  actor: AuthSession,
): Hostel {
  if (!["admin", "super_admin"].includes(actor.role)) throw forbidden("Admins only.");
  const timestamp = now();
  const id = nextId("HST");

  run(
    `INSERT INTO hostels (id, name, kind, gender, capacity, warden_id, warden_name, active, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,1,?,?,?)`,
    [id, data.name, data.kind, data.gender, data.capacity ?? null,
     data.wardenId ?? null, data.wardenName ?? "", data.notes ?? null, timestamp, timestamp],
  );

  audit(actor, { action: "hostel.created", entity: "hostel", entityId: id, summary: `Created hostel ${data.name}.` });
  return findHostel(id)!;
}

export function assignStudentToHostel(
  studentId: string,
  hostelId: string,
  roomNumber: string,
  approverId: string | null,
  approverName: string,
  actor: AuthSession,
): HostelMembership {
  if (!["admin", "super_admin"].includes(actor.role)) throw forbidden("Admins only.");
  const timestamp = now();

  tx(() => {
    // Deactivate previous membership
    run("UPDATE hostel_memberships SET active = 0 WHERE student_id = ? AND active = 1", [studentId]);

    const id = nextId("HMB");
    run(
      `INSERT INTO hostel_memberships (id, student_id, hostel_id, room_number, approver_id, approver_name, active, assigned_at, assigned_by)
       VALUES (?,?,?,?,?,?,1,?,?)`,
      [id, studentId, hostelId, roomNumber, approverId, approverName, timestamp, actor.name],
    );
  });

  audit(actor, {
    action: "hostel.assigned",
    entity: "hostel_membership",
    entityId: studentId,
    summary: `${actor.name} assigned student ${studentId} to hostel ${hostelId}, room ${roomNumber}.`,
  });

  return getStudentMembership(studentId)!;
}

/* ------------------------------------------------------------------ *
 * Outpass requests
 * ------------------------------------------------------------------ */

export function findOutpass(id: string): OutpassRequest | null {
  const r = get<Row>("SELECT * FROM outpass_requests WHERE id = ?", [id]);
  return r ? mapOutpass(r) : null;
}

export function listOutpassRequests(opts: {
  studentId?: string;
  approverId?: string;
  status?: OutpassStatus | OutpassStatus[];
  limit?: number;
} = {}): OutpassRequest[] {
  const conditions: string[] = [];
  const params: SqlValue[] = [];

  if (opts.studentId) { conditions.push("student_id = ?"); params.push(opts.studentId); }
  if (opts.approverId) { conditions.push("approver_id = ?"); params.push(opts.approverId); }
  if (opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    conditions.push(`status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;
  const rows = all<Row>(
    `SELECT * FROM outpass_requests ${where} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit],
  );
  return rows.map(mapOutpass);
}

export interface CreateOutpassInput {
  purpose: string;
  destination?: string;
  emergencyContact?: string;
  departureAt: string;
  expectedReturnAt?: string | null;
  notes?: string | null;
}

/**
 * Student submits an outpass request.
 * The student_id comes from the authenticated session — never client-supplied.
 */
export function submitOutpassRequest(
  input: CreateOutpassInput,
  actor: AuthSession,
): OutpassRequest {
  if (actor.role !== "student") throw forbidden("Only students can submit outpass requests.");
  if (!actor.refId) throw badRequest("Student profile not linked to your account.");

  // Find student record
  const student = get<Row>("SELECT * FROM students WHERE id = ?", [actor.refId]);
  if (!student) throw notFound("Student record not found.");

  // Find hostel membership
  const membership = getStudentMembership(actor.refId);
  const approverId = membership?.approverId ?? null;
  const approverName = membership?.approverName ?? "";

  const timestamp = now();
  const id = nextId("OPR");

  run(
    `INSERT INTO outpass_requests
       (id, student_id, student_name, student_roll, hostel_id, hostel_name,
        purpose, destination, emergency_contact, departure_at, expected_return_at,
        notes, approver_id, approver_name, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING',?,?)`,
    [
      id,
      actor.refId,
      String(student.name),
      String(student.roll_no),
      membership?.hostelId ?? null,
      membership?.hostelName ?? "",
      input.purpose,
      input.destination ?? "",
      input.emergencyContact ?? "",
      input.departureAt,
      input.expectedReturnAt ?? null,
      input.notes ?? null,
      approverId,
      approverName,
      timestamp,
      timestamp,
    ],
  );

  // Notify warden
  if (approverId) {
    notify({
      type: "request",
      title: "Outpass request awaiting approval",
      message: `${String(student.name)} (${String(student.roll_no)}) has requested an outpass for ${input.purpose}.`,
      href: "/teacher/outpass",
      audience: "teacher",
    });
  } else {
    notify({
      type: "request",
      title: "Outpass request — no approver assigned",
      message: `Student ${String(student.name)} submitted outpass ${id} but no warden is assigned. Manual review needed.`,
      href: "/admin/hostel",
      audience: "admin",
    });
  }

  audit(actor, {
    action: "outpass.submitted",
    entity: "outpass_request",
    entityId: id,
    summary: `${actor.name} submitted outpass request for ${input.purpose}.`,
  });

  publish("outpass", "created", id);
  return findOutpass(id)!;
}

/* ------------------------------------------------------------------ *
 * Warden approval / rejection
 * ------------------------------------------------------------------ */

/**
 * Approve an outpass request and generate a secure QR pass.
 * Returns the StudentPass with the plaintext passToken (one-time — never retrievable again).
 */
export function approveOutpass(
  outpassId: string,
  actor: AuthSession,
): { outpass: OutpassRequest; pass: StudentPass } {
  if (!["teacher", "admin", "super_admin"].includes(actor.role)) {
    throw forbidden("Only wardens and admins can approve outpass requests.");
  }

  const outpass = findOutpass(outpassId);
  if (!outpass) throw notFound("That outpass request does not exist.");
  if (outpass.status !== "PENDING") throw conflict("This request has already been decided.");

  // Verify the actor is the authorized approver (teachers only)
  if (actor.role === "teacher" && outpass.approverId !== actor.refId) {
    throw forbidden("You are not the authorized approver for this student.");
  }

  const timestamp = now();

  const result = tx(() => {
    // Approve the request
    run(
      `UPDATE outpass_requests
         SET status = 'APPROVED', decided_at = ?, decided_by = ?, updated_at = ?
       WHERE id = ? AND status = 'PENDING'`,
      [timestamp, actor.name, timestamp, outpassId],
    );

    // Generate secure pass token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);
    const passId = nextId("SPT");

    // Valid from departure time, valid until expected return + 2h grace
    const validFrom = outpass.departureAt;
    const returnTime = outpass.expectedReturnAt
      ? new Date(outpass.expectedReturnAt).getTime()
      : new Date(outpass.departureAt).getTime() + 24 * 3_600_000;
    const validUntil = new Date(returnTime + 2 * 3_600_000).toISOString();

    run(
      `INSERT INTO student_passes
         (id, outpass_id, student_id, student_name, pass_token_hash,
          valid_from, valid_until, state, issued_by, issued_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        passId,
        outpassId,
        outpass.studentId,
        outpass.studentName,
        tokenHash,
        validFrom,
        validUntil,
        "ACTIVE",
        actor.name,
        timestamp,
      ],
    );

    // Notify student
    notify({
      type: "approval",
      title: "Outpass approved ✓",
      message: `Your outpass for "${outpass.purpose}" has been approved by ${actor.name}. Your QR pass is ready.`,
      href: "/student",
    });

    audit(actor, {
      action: "outpass.approved",
      entity: "outpass_request",
      entityId: outpassId,
      summary: `${actor.name} approved outpass ${outpassId} for ${outpass.studentName}.`,
    });

    const updatedOutpass = findOutpass(outpassId)!;
    const passRow = get<Row>("SELECT * FROM student_passes WHERE id = ?", [passId])!;
    const pass = mapPass(passRow, rawToken); // token sent once here

    return { outpass: updatedOutpass, pass };
  });

  publish("outpass", "approved", outpassId);
  return result;
}

export function rejectOutpass(
  outpassId: string,
  reason: string,
  actor: AuthSession,
): OutpassRequest {
  if (!["teacher", "admin", "super_admin"].includes(actor.role)) {
    throw forbidden("Only wardens and admins can reject outpass requests.");
  }

  const outpass = findOutpass(outpassId);
  if (!outpass) throw notFound("That outpass request does not exist.");
  if (outpass.status !== "PENDING") throw conflict("This request has already been decided.");

  if (actor.role === "teacher" && outpass.approverId !== actor.refId) {
    throw forbidden("You are not the authorized approver for this student.");
  }

  const timestamp = now();

  run(
    `UPDATE outpass_requests
       SET status = 'REJECTED', decided_at = ?, decided_by = ?, rejection_reason = ?, updated_at = ?
     WHERE id = ? AND status = 'PENDING'`,
    [timestamp, actor.name, reason, timestamp, outpassId],
  );

  notify({
    type: "rejection",
    title: "Outpass not approved",
    message: `Your outpass for "${outpass.purpose}" was not approved. Reason: ${reason}`,
    href: "/student",
  });

  audit(actor, {
    action: "outpass.rejected",
    entity: "outpass_request",
    entityId: outpassId,
    summary: `${actor.name} rejected outpass ${outpassId}: ${reason}`,
  });

  publish("outpass", "rejected", outpassId);
  return findOutpass(outpassId)!;
}

/* ------------------------------------------------------------------ *
 * Student pass — QR verification at gate
 * ------------------------------------------------------------------ */

export function findPassByToken(rawToken: string): StudentPass | null {
  const hash = sha256(rawToken);
  const r = get<Row>("SELECT * FROM student_passes WHERE pass_token_hash = ?", [hash]);
  return r ? mapPass(r) : null;
}

export function findPassByOutpass(outpassId: string): StudentPass | null {
  const r = get<Row>("SELECT * FROM student_passes WHERE outpass_id = ?", [outpassId]);
  return r ? mapPass(r) : null;
}

export function getStudentPassForDisplay(outpassId: string, actor: AuthSession): StudentPass | null {
  const pass = findPassByOutpass(outpassId);
  if (!pass) return null;

  // Students can only see their own pass
  if (actor.role === "student" && pass.studentId !== actor.refId) {
    throw forbidden("You can only view your own pass.");
  }

  return pass; // passToken is undefined here (not included in DB reads)
}

export interface GateScanInput {
  rawToken: string;
  direction: "EXIT" | "ENTRY";
  gate: string;
  note?: string;
  isOverride?: boolean;
  overrideNote?: string;
}

/**
 * Guard scans a student pass at the gate.
 * Enforces INSIDE_HOSTEL → EXITED → RETURNED transitions.
 */
export function scanStudentPass(input: GateScanInput, actor: AuthSession): {
  allowed: boolean;
  reason: string;
  event?: StudentGateEvent;
  pass?: StudentPass;
  outpass?: OutpassRequest;
} {
  if (!["security", "admin", "super_admin"].includes(actor.role)) {
    throw forbidden("Only security personnel can scan student passes.");
  }

  const pass = findPassByToken(input.rawToken);
  if (!pass) return { allowed: false, reason: "Pass not found. The QR code is invalid." };

  const outpass = findOutpass(pass.outpassId);
  if (!outpass) return { allowed: false, reason: "Outpass record not found." };

  // Validity window check
  const now_ts = new Date().toISOString();
  if (now_ts < pass.validFrom) {
    return { allowed: false, reason: `Pass is not yet valid. Valid from: ${pass.validFrom}`, pass, outpass };
  }
  if (now_ts > pass.validUntil) {
    // Mark expired
    run("UPDATE student_passes SET state = 'EXPIRED', late_return = 1 WHERE id = ?", [pass.id]);
    return { allowed: false, reason: "This pass has expired.", pass, outpass };
  }

  // State machine check
  if (input.direction === "EXIT") {
    if (pass.state !== "ACTIVE") {
      return {
        allowed: input.isOverride ?? false,
        reason: pass.state === "EXITED"
          ? "Student has already exited. Duplicate exit scan."
          : `Pass is in state ${pass.state} — cannot process EXIT.`,
        pass,
        outpass,
      };
    }
  } else {
    // ENTRY
    if (pass.state !== "EXITED") {
      return {
        allowed: input.isOverride ?? false,
        reason: pass.state === "RETURNED"
          ? "Student has already returned."
          : pass.state === "ACTIVE"
          ? "Student has not yet exited — EXIT scan required first."
          : `Pass is in state ${pass.state} — cannot process ENTRY.`,
        pass,
        outpass,
      };
    }
  }

  const timestamp = now();
  const event = tx(() => {
    const evtId = nextId("SGE");
    run(
      `INSERT INTO student_gate_events
         (id, pass_id, outpass_id, student_id, student_name, direction, gate,
          scanned_by, scanned_by_name, note, is_override, override_by, override_note, at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        evtId,
        pass.id,
        pass.outpassId,
        pass.studentId,
        pass.studentName,
        input.direction,
        input.gate,
        actor.refId ?? null,
        actor.name,
        input.note ?? null,
        input.isOverride ? 1 : 0,
        input.isOverride ? actor.name : null,
        input.overrideNote ?? null,
        timestamp,
      ],
    );

    // Update pass state
    const newState: StudentPassState = input.direction === "EXIT" ? "EXITED" : "RETURNED";
    run("UPDATE student_passes SET state = ?, updated_at = ? WHERE id = ?", [newState, timestamp, pass.id]);

    // Update outpass if student returned
    if (input.direction === "ENTRY") {
      run("UPDATE outpass_requests SET updated_at = ? WHERE id = ?", [timestamp, pass.outpassId]);
    }

    audit(actor, {
      action: `student_gate.${input.direction.toLowerCase()}`,
      entity: "student_gate_event",
      entityId: evtId,
      summary: `${actor.name} scanned student ${pass.studentName} ${input.direction} at ${input.gate}.`,
    });

    const row = get<Row>("SELECT * FROM student_gate_events WHERE id = ?", [evtId])!;
    return mapGateEvent(row);
  });

  publish("outpass", `gate_${input.direction.toLowerCase()}`, pass.id);
  return { allowed: true, reason: `${input.direction} recorded successfully.`, event, pass, outpass };
}

/* ------------------------------------------------------------------ *
 * Late return detection (server-side scheduled check)
 * ------------------------------------------------------------------ */

export function detectLateReturns(): { flagged: number; passIds: string[] } {
  const timestamp = now();
  const latePasses = all<Row>(
    `SELECT sp.* FROM student_passes sp
     WHERE sp.state = 'EXITED'
       AND sp.valid_until < ?
       AND sp.late_return = 0`,
    [timestamp],
  );

  const flaggedIds: string[] = [];
  for (const row of latePasses) {
    const passId = String(row.id);
    const outpass = findOutpass(String(row.outpass_id));

    run(
      "UPDATE student_passes SET late_return = 1, late_alert_sent = 1 WHERE id = ?",
      [passId],
    );

    notify({
      type: "security",
      title: `Late return alert: ${String(row.student_name)}`,
      message: `Student ${String(row.student_name)} has not returned by their expected time (${String(row.valid_until)}). Outpass: ${String(row.outpass_id)}.`,
      href: "/admin/hostel",
      audience: "admin",
    });

    flaggedIds.push(passId);
  }

  return { flagged: flaggedIds.length, passIds: flaggedIds };
}
