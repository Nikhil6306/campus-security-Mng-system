import "server-only";

import type {
  AuthSession,
  EquipmentHandoverItem,
  GateStaffingRequirement,
  GuardAssignmentStatus,
  GuardDutyDashboardStats,
  GuardShiftAssignment,
  GuardShiftSession,
  GuardShiftType,
  HandoverStatus,
  PatrolCheckpoint,
  PatrolRoute,
  PatrolSubmission,
  ShiftHandover,
  ShiftHandoverItem,
} from "@/lib/types";
import { all, get, nextId, run, toText, tx } from "../db";
import type { Row } from "../db";
import { AppError, badRequest, conflict, forbidden, notFound } from "../errors";
import { audit, notify } from "../audit";
import { campusMinutesNow, todayInCampusTz } from "@/lib/utils";
import { persistSecondaryToSupabase, persistToSupabase } from "../supabase-db";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Guard Duty Management & Shift Handover Service
 * Production-ready enterprise implementation for Campus Security.
 */

/* ------------------------------------------------------------------ *
 * Helper mappers
 * ------------------------------------------------------------------ */

function mapAssignment(r: Row): GuardShiftAssignment {
  return {
    id: String(r.id),
    guardId: String(r.guard_id),
    guardName: String(r.guard_name),
    gate: String(r.gate),
    dutyDate: String(r.duty_date),
    shiftType: r.shift_type as GuardShiftType,
    startTime: String(r.start_time),
    endTime: String(r.end_time),
    isOvernight: Boolean(r.is_overnight),
    supervisorId: r.supervisor_id ? String(r.supervisor_id) : null,
    supervisorName: String(r.supervisor_name || ""),
    status: r.status as GuardAssignmentStatus,
    reassignReason: r.reassign_reason ? String(r.reassign_reason) : null,
    reassignedFromId: r.reassigned_from_id ? String(r.reassigned_from_id) : null,
    notes: r.notes ? String(r.notes) : null,
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapSession(r: Row): GuardShiftSession {
  return {
    id: String(r.id),
    assignmentId: String(r.assignment_id),
    guardId: String(r.guard_id),
    guardName: String(r.guard_name),
    gate: String(r.gate),
    actualStart: String(r.actual_start),
    actualEnd: r.actual_end ? String(r.actual_end) : null,
    checkinStatus: r.checkin_status as "On-Time" | "Late" | "Early",
    lateMinutes: Number(r.late_minutes || 0),
    lateReason: r.late_reason ? String(r.late_reason) : null,
    notes: r.notes ? String(r.notes) : null,
    status: r.status as any,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapHandover(r: Row): ShiftHandover {
  let equipment: EquipmentHandoverItem[] = [];
  try {
    equipment = r.equipment_details ? JSON.parse(String(r.equipment_details)) : [];
  } catch {
    equipment = [];
  }
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    outgoingGuardId: String(r.outgoing_guard_id),
    outgoingGuardName: String(r.outgoing_guard_name),
    incomingGuardId: r.incoming_guard_id ? String(r.incoming_guard_id) : null,
    incomingGuardName: String(r.incoming_guard_name || ""),
    gate: String(r.gate),
    dutyDate: String(r.duty_date),
    shiftType: r.shift_type as GuardShiftType,
    status: r.status as HandoverStatus,
    equipmentDetails: equipment,
    generalNotes: String(r.general_notes || ""),
    urgentIssues: String(r.urgent_issues || ""),
    pendingVisitorsCount: Number(r.pending_visitors_count || 0),
    openIncidentsCount: Number(r.open_incidents_count || 0),
    patrolCompletedCount: Number(r.patrol_completed_count || 0),
    patrolTotalCount: Number(r.patrol_total_count || 0),
    submittedAt: r.submitted_at ? String(r.submitted_at) : null,
    incomingAcknowledgedAt: r.incoming_acknowledged_at ? String(r.incoming_acknowledged_at) : null,
    incomingNotes: r.incoming_notes ? String(r.incoming_notes) : null,
    disputedItems: r.disputed_items ? String(r.disputed_items) : null,
    supervisorId: r.supervisor_id ? String(r.supervisor_id) : null,
    supervisorName: r.supervisor_name ? String(r.supervisor_name) : null,
    supervisorDecision: (r.supervisor_decision as any) || null,
    supervisorNotes: r.supervisor_notes ? String(r.supervisor_notes) : null,
    rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
    decidedAt: r.decided_at ? String(r.decided_at) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapCheckpoint(r: Row): PatrolCheckpoint {
  let requiredItems: string[] = [];
  try {
    requiredItems = r.required_items ? JSON.parse(String(r.required_items)) : [];
  } catch {
    requiredItems = [];
  }
  return {
    id: String(r.id),
    routeId: String(r.route_id),
    title: String(r.title),
    location: String(r.location),
    instructions: String(r.instructions || ""),
    requiredItems,
    orderIndex: Number(r.order_index || 1),
    photoRequired: Boolean(r.photo_required),
    active: Boolean(r.active),
  };
}

function mapSubmission(r: Row): PatrolSubmission {
  let itemsChecked: Record<string, "Pass" | "Fail" | "N/A"> = {};
  try {
    itemsChecked = r.items_checked ? JSON.parse(String(r.items_checked)) : {};
  } catch {
    itemsChecked = {};
  }
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    checkpointId: String(r.checkpoint_id),
    checkpointTitle: r.checkpoint_title ? String(r.checkpoint_title) : undefined,
    checkpointLocation: r.checkpoint_location ? String(r.checkpoint_location) : undefined,
    guardId: String(r.guard_id),
    guardName: String(r.guard_name),
    status: r.status as "Pass" | "Fail" | "N/A",
    observations: String(r.observations || ""),
    photoUrl: r.photo_url ? String(r.photo_url) : null,
    itemsChecked,
    escalated: Boolean(r.escalated),
    escalationNotes: r.escalation_notes ? String(r.escalation_notes) : null,
    submittedAt: String(r.submitted_at),
  };
}

/* ------------------------------------------------------------------ *
 * Staffing Requirements
 * ------------------------------------------------------------------ */

export function getStaffingRequirements(): GateStaffingRequirement[] {
  const rows = all("SELECT * FROM gate_staffing_requirements ORDER BY gate, shift_type");
  return rows.map((r) => ({
    id: String(r.id),
    gate: String(r.gate),
    shiftType: r.shift_type as GuardShiftType,
    minGuards: Number(r.min_guards),
    idealGuards: Number(r.ideal_guards),
    updatedAt: String(r.updated_at),
  }));
}

export function setStaffingRequirement(
  gate: string,
  shiftType: GuardShiftType,
  minGuards: number,
  idealGuards: number,
  actor: AuthSession,
): GateStaffingRequirement {
  if (minGuards < 1) throw badRequest("Minimum guards must be at least 1.");
  if (idealGuards < minGuards) throw badRequest("Ideal guards cannot be less than minimum guards.");

  const now = new Date().toISOString();
  const id = `REQ-${gate.replace(/\s+/g, "").toUpperCase()}-${shiftType.toUpperCase()}`;

  tx(() => {
    run(
      `INSERT INTO gate_staffing_requirements (id, gate, shift_type, min_guards, ideal_guards, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(gate, shift_type) DO UPDATE SET min_guards = excluded.min_guards,
         ideal_guards = excluded.ideal_guards, updated_at = excluded.updated_at`,
      [id, gate, shiftType, minGuards, idealGuards, now],
    );

    audit(actor, {
      action: "guard.staffing.configured",
      entity: "gate_staffing",
      entityId: id,
      summary: `${actor.name} configured staffing for ${gate} (${shiftType}): min ${minGuards}, ideal ${idealGuards}`,
    });
  });

  persistSecondaryToSupabase("gate_staffing_requirements", {
    id,
    gate,
    shift_type: shiftType,
    min_guards: minGuards,
    ideal_guards: idealGuards,
    updated_at: now,
  });

  return { id, gate, shiftType, minGuards, idealGuards, updatedAt: now };
}

/* ------------------------------------------------------------------ *
 * Dashboard Statistics
 * ------------------------------------------------------------------ */

export function getGuardDutyDashboardStats(targetDate = todayInCampusTz()): GuardDutyDashboardStats {
  const totalGuards = Number(get<{ c: number }>("SELECT COUNT(*) AS c FROM security_guards WHERE status != 'Suspended'")?.c || 0);

  // Guards currently on active duty
  const guardsOnDuty = Number(
    get<{ c: number }>(
      `SELECT COUNT(DISTINCT s.guard_id) AS c
         FROM guard_shift_sessions s
        WHERE s.status = 'Active'`,
    )?.c || 0,
  );

  // Scheduled for today but not yet checked in
  const guardsNotCheckedIn = Number(
    get<{ c: number }>(
      `SELECT COUNT(*) AS c
         FROM guard_shift_assignments a
        WHERE a.duty_date = ?
          AND a.status = 'Scheduled'
          AND NOT EXISTS (SELECT 1 FROM guard_shift_sessions s WHERE s.assignment_id = a.id)`,
      [targetDate],
    )?.c || 0,
  );

  // Active gate assignments
  const activeGateAssignments = Number(
    get<{ c: number }>(
      `SELECT COUNT(DISTINCT gate) AS c
         FROM guard_shift_assignments
        WHERE (status = 'Active' OR (duty_date = ? AND status = 'Scheduled'))`,
      [targetDate],
    )?.c || 0,
  );

  // Shift handovers pending review or incoming ack
  const pendingShiftHandovers = Number(
    get<{ c: number }>(
      `SELECT COUNT(*) AS c
         FROM shift_handovers
        WHERE status IN ('Submitted', 'Awaiting Incoming Guard', 'Acknowledged', 'Pending Supervisor Review')`,
    )?.c || 0,
  );

  // Unresolved incidents currently inside
  const unresolvedIncidentsRequiringHandover = Number(
    get<{ c: number }>("SELECT COUNT(*) AS c FROM incidents WHERE status IN ('Open', 'Investigating')")?.c || 0,
  );

  // Incomplete / pending patrol checkpoints for active sessions today
  const pendingPatrolCheckpoints = Number(
    get<{ c: number }>(
      `SELECT COUNT(*) AS c
         FROM patrol_checkpoints pc
        WHERE pc.active = 1
          AND NOT EXISTS (
            SELECT 1 FROM patrol_submissions ps
             JOIN guard_shift_sessions ses ON ses.id = ps.session_id
            WHERE ps.checkpoint_id = pc.id
              AND ses.actual_start LIKE ?
          )`,
      [`${targetDate}%`],
    )?.c || 0,
  );

  // Handovers awaiting supervisor decision
  const handoversAwaitingApproval = Number(
    get<{ c: number }>(
      `SELECT COUNT(*) AS c
         FROM shift_handovers
        WHERE status IN ('Acknowledged', 'Pending Supervisor Review')`,
    )?.c || 0,
  );

  return {
    totalGuards,
    guardsOnDuty,
    guardsNotCheckedIn,
    activeGateAssignments,
    pendingShiftHandovers,
    unresolvedIncidentsRequiringHandover,
    pendingPatrolCheckpoints,
    handoversAwaitingApproval,
  };
}

/**
 * Gate-wise staffing status report: identifies understaffed gates.
 */
export function getGateStaffingStatus(date = todayInCampusTz()) {
  const gates = all<{ name: string }>("SELECT name FROM campus_locations WHERE kind = 'Gate' AND active = 1");
  const shifts: GuardShiftType[] = ["Morning", "Evening", "Night"];
  const requirements = getStaffingRequirements();
  const assignments = all<Row>(
    `SELECT gate, shift_type, COUNT(*) AS assigned_count
       FROM guard_shift_assignments
      WHERE duty_date = ? AND status NOT IN ('Cancelled', 'Reassigned')
      GROUP BY gate, shift_type`,
    [date],
  );

  const report = [];

  for (const g of gates) {
    for (const s of shifts) {
      const req = requirements.find((r) => r.gate === g.name && r.shiftType === s);
      const minRequired = req ? req.minGuards : 1;
      const idealRequired = req ? req.idealGuards : 2;
      const match = assignments.find((a) => a.gate === g.name && a.shift_type === s);
      const assignedCount = match ? Number(match.assigned_count) : 0;
      const isUnderstaffed = assignedCount < minRequired;

      report.push({
        gate: g.name,
        shiftType: s,
        minRequired,
        idealRequired,
        assignedCount,
        isUnderstaffed,
        shortfall: Math.max(0, minRequired - assignedCount),
      });
    }
  }

  return report;
}

/* ------------------------------------------------------------------ *
 * Shift Duty Assignments
 * ------------------------------------------------------------------ */

export interface CreateAssignmentInput {
  guardId: string;
  gate: string;
  dutyDate: string; // YYYY-MM-DD
  shiftType: GuardShiftType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  supervisorId?: string;
  supervisorName?: string;
  notes?: string;
}

export async function createGuardAssignment(
  input: CreateAssignmentInput,
  actor: AuthSession,
): Promise<GuardShiftAssignment> {
  const guard = get<Row>("SELECT id, full_name, status FROM security_guards WHERE id = ?", [input.guardId]);
  if (!guard) throw notFound("Guard not found in registry.");
  if (guard.status === "Suspended") throw badRequest("This guard is currently suspended and cannot be assigned.");

  // Check for duplicate assignment for the exact same guard, date, and shift
  const duplicate = get<Row>(
    `SELECT id FROM guard_shift_assignments
      WHERE guard_id = ? AND duty_date = ? AND shift_type = ? AND status NOT IN ('Cancelled', 'Reassigned')`,
    [input.guardId, input.dutyDate, input.shiftType],
  );
  if (duplicate) {
    throw conflict(`Guard ${guard.full_name} is already assigned to a ${input.shiftType} shift on ${input.dutyDate}.`);
  }

  // Detect overlapping shift times for this guard on the same day
  const overlaps = all<Row>(
    `SELECT id, start_time, end_time, gate, shift_type
       FROM guard_shift_assignments
      WHERE guard_id = ? AND duty_date = ? AND status NOT IN ('Cancelled', 'Reassigned')`,
    [input.guardId, input.dutyDate],
  );

  const startM = toMinutes(input.startTime);
  let endM = toMinutes(input.endTime);
  const isOvernight = startM > endM;
  if (isOvernight) endM += 24 * 60; // normalize overnight boundary

  for (const o of overlaps) {
    const oStartM = toMinutes(String(o.start_time));
    let oEndM = toMinutes(String(o.end_time));
    if (oStartM > oEndM) oEndM += 24 * 60;

    // Overlap condition: start < otherEnd && end > otherStart
    if (startM < oEndM && endM > oStartM) {
      throw conflict(
        `Shift time ${input.startTime}-${input.endTime} overlaps with existing ${o.shift_type} shift (${o.start_time}-${o.end_time}) at ${o.gate}.`,
      );
    }
  }

  const id = nextId("ASN", { pad: 4 });
  const now = new Date().toISOString();

  tx(() => {
    run(
      `INSERT INTO guard_shift_assignments
         (id, guard_id, guard_name, gate, duty_date, shift_type, start_time, end_time, is_overnight,
          supervisor_id, supervisor_name, status, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?, ?)`,
      [
        id,
        toText(guard.id),
        toText(guard.full_name),
        input.gate,
        input.dutyDate,
        input.shiftType,
        input.startTime,
        input.endTime,
        isOvernight ? 1 : 0,
        input.supervisorId || actor.userId,
        input.supervisorName || actor.name,
        input.notes || null,
        actor.name,
        now,
        now,
      ],
    );

    audit(actor, {
      action: "guard.assignment.created",
      entity: "guard_assignment",
      entityId: id,
      summary: `${actor.name} assigned guard ${guard.full_name} to ${input.gate} for ${input.shiftType} shift on ${input.dutyDate}`,
    });

    notify({
      type: "gate",
      title: "New Duty Assignment",
      message: `Guard ${guard.full_name} assigned to ${input.gate} (${input.shiftType} shift) on ${input.dutyDate}.`,
      href: "/admin/guard-duty",
    });
  });

  const record = requireAssignment(id);

  if (isSupabaseConfigured()) {
    try {
      await persistToSupabase("guard_shift_assignments", {
        id: record.id,
        guard_id: record.guardId,
        guard_name: record.guardName,
        gate: record.gate,
        duty_date: record.dutyDate,
        shift_type: record.shiftType,
        start_time: record.startTime,
        end_time: record.endTime,
        is_overnight: record.isOvernight,
        supervisor_id: record.supervisorId,
        supervisor_name: record.supervisorName,
        status: record.status,
        notes: record.notes,
        created_by: record.createdBy,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      });
    } catch (err) {
      console.error(`[guard-duty] Supabase persistence error for assignment ${id}:`, err);
    }
  }

  return record;
}

export function requireAssignment(id: string): GuardShiftAssignment {
  const row = get<Row>("SELECT * FROM guard_shift_assignments WHERE id = ?", [id]);
  if (!row) throw notFound("Duty assignment not found.");
  return mapAssignment(row);
}

export async function reassignGuardAssignment(
  id: string,
  newGuardId: string,
  reason: string,
  actor: AuthSession,
): Promise<{ cancelled: GuardShiftAssignment; replacement: GuardShiftAssignment }> {
  if (!reason.trim()) throw badRequest("A mandatory reassignment reason must be provided.");
  const current = requireAssignment(id);
  if (current.status === "Completed") throw conflict("Completed shifts cannot be reassigned.");

  const newGuard = get<Row>("SELECT id, full_name FROM security_guards WHERE id = ?", [newGuardId]);
  if (!newGuard) throw notFound("New guard not found in registry.");

  const now = new Date().toISOString();
  const replacementId = nextId("ASN", { pad: 4 });

  tx(() => {
    // 1. Mark original assignment as Reassigned
    run(
      `UPDATE guard_shift_assignments
          SET status = 'Reassigned', reassign_reason = ?, updated_at = ?
        WHERE id = ?`,
      [reason, now, current.id],
    );

    // 2. Create the replacement assignment
    run(
      `INSERT INTO guard_shift_assignments
         (id, guard_id, guard_name, gate, duty_date, shift_type, start_time, end_time, is_overnight,
          supervisor_id, supervisor_name, status, reassigned_from_id, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?, ?, ?)`,
      [
        replacementId,
        toText(newGuard.id),
        toText(newGuard.full_name),
        current.gate,
        current.dutyDate,
        current.shiftType,
        current.startTime,
        current.endTime,
        current.isOvernight ? 1 : 0,
        actor.userId,
        actor.name,
        current.id,
        `Reassigned from ${current.guardName}. Reason: ${reason}`,
        actor.name,
        now,
        now,
      ],
    );

    audit(actor, {
      action: "guard.assignment.reassigned",
      entity: "guard_assignment",
      entityId: current.id,
      summary: `${actor.name} reassigned duty ${current.id} from ${current.guardName} to ${newGuard.full_name} (${reason})`,
    });
  });

  const cancelled = requireAssignment(current.id);
  const replacement = requireAssignment(replacementId);

  persistSecondaryToSupabase("guard_shift_assignments", {
    id: cancelled.id,
    status: cancelled.status,
    reassign_reason: cancelled.reassignReason,
    updated_at: cancelled.updatedAt,
  }, "update");

  persistSecondaryToSupabase("guard_shift_assignments", {
    id: replacement.id,
    guard_id: replacement.guardId,
    guard_name: replacement.guardName,
    gate: replacement.gate,
    duty_date: replacement.dutyDate,
    shift_type: replacement.shiftType,
    start_time: replacement.startTime,
    end_time: replacement.endTime,
    is_overnight: replacement.isOvernight,
    supervisor_id: replacement.supervisorId,
    supervisor_name: replacement.supervisorName,
    status: replacement.status,
    reassigned_from_id: replacement.reassignedFromId,
    notes: replacement.notes,
    created_by: replacement.createdBy,
    created_at: replacement.createdAt,
    updated_at: replacement.updatedAt,
  });

  return { cancelled, replacement };
}

export function listGuardAssignments(filters: {
  date?: string;
  gate?: string;
  shift?: string;
  guardId?: string;
  status?: string;
  search?: string;
}): GuardShiftAssignment[] {
  let sql = "SELECT * FROM guard_shift_assignments WHERE 1=1";
  const params: unknown[] = [];

  if (filters.date) {
    sql += " AND duty_date = ?";
    params.push(filters.date);
  }
  if (filters.gate) {
    sql += " AND gate = ?";
    params.push(filters.gate);
  }
  if (filters.shift) {
    sql += " AND shift_type = ?";
    params.push(filters.shift);
  }
  if (filters.guardId) {
    sql += " AND guard_id = ?";
    params.push(filters.guardId);
  }
  if (filters.status) {
    sql += " AND status = ?";
    params.push(filters.status);
  }
  if (filters.search) {
    sql += " AND (guard_name LIKE ? OR gate LIKE ? OR notes LIKE ?)";
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  sql += " ORDER BY duty_date DESC, start_time ASC";
  const rows = all(sql, params as any[]);
  return rows.map(mapAssignment);
}

/* ------------------------------------------------------------------ *
 * Shift Check-In & Check-Out Execution
 * ------------------------------------------------------------------ */

export async function startGuardShift(
  assignmentId: string,
  notes: string | undefined,
  actor: AuthSession,
): Promise<{ assignment: GuardShiftAssignment; session: GuardShiftSession }> {
  const assignment = requireAssignment(assignmentId);

  // Authorization check: guards can only start their own shift unless supervisor/admin
  if (actor.role === "security" && actor.refId && actor.refId !== assignment.guardId) {
    throw forbidden("You can only check in to your own assigned shift.");
  }

  if (assignment.status === "Active") {
    throw conflict("This shift has already been started.");
  }
  if (assignment.status === "Completed") {
    throw conflict("This shift has already been marked completed.");
  }
  if (assignment.status === "Cancelled" || assignment.status === "Reassigned") {
    throw conflict(`Cannot check in to a ${assignment.status.toLowerCase()} assignment.`);
  }

  // Prevent duplicate active sessions for the same guard at another gate
  const existingActive = get<Row>(
    `SELECT id, gate FROM guard_shift_sessions WHERE guard_id = ? AND status = 'Active'`,
    [assignment.guardId],
  );
  if (existingActive) {
    throw conflict(`Guard already has an active shift session at ${existingActive.gate}. Check out first.`);
  }

  const nowIso = new Date().toISOString();
  const nowMins = campusMinutesNow();
  const schedMins = toMinutes(assignment.startTime);

  let checkinStatus: "On-Time" | "Late" | "Early" = "On-Time";
  let lateMinutes = 0;
  let lateReason: string | null = null;

  // Lateness threshold: more than 15 minutes past scheduled start time on the duty date
  const today = todayInCampusTz();
  if (assignment.dutyDate === today) {
    if (nowMins > schedMins + 15) {
      checkinStatus = "Late";
      lateMinutes = nowMins - schedMins;
      lateReason = `Late check-in by ${lateMinutes} minutes (scheduled at ${assignment.startTime})`;
    } else if (nowMins < schedMins - 30) {
      checkinStatus = "Early";
    }
  }

  const sessionId = nextId("SES", { pad: 4 });

  tx(() => {
    // 1. Create shift session
    run(
      `INSERT INTO guard_shift_sessions
         (id, assignment_id, guard_id, guard_name, gate, actual_start, checkin_status,
          late_minutes, late_reason, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
      [
        sessionId,
        assignment.id,
        assignment.guardId,
        assignment.guardName,
        assignment.gate,
        nowIso,
        checkinStatus,
        lateMinutes,
        lateReason,
        notes || null,
        nowIso,
        nowIso,
      ],
    );

    // 2. Mark assignment as Active
    run(`UPDATE guard_shift_assignments SET status = 'Active', updated_at = ? WHERE id = ?`, [nowIso, assignment.id]);

    // 3. Mark guard as On Duty at this gate
    run(
      `UPDATE security_guards
          SET status = 'On Duty', assigned_gate = ?, updated_at = ?
        WHERE id = ?`,
      [assignment.gate, nowIso, assignment.guardId],
    );

    audit(actor, {
      action: "guard.shift.started",
      entity: "guard_shift_session",
      entityId: sessionId,
      summary: `Guard ${assignment.guardName} checked in to ${assignment.gate} (${checkinStatus}${lateMinutes > 0 ? ` +${lateMinutes}m` : ""})`,
    });

    if (checkinStatus === "Late") {
      notify({
        type: "gate",
        title: "Late Shift Check-In Flagged",
        message: `Guard ${assignment.guardName} checked in late (${lateMinutes} mins) at ${assignment.gate}.`,
        href: "/admin/guard-duty",
      });
    }
  });

  const updatedAssignment = requireAssignment(assignment.id);
  const sessionRow = get<Row>("SELECT * FROM guard_shift_sessions WHERE id = ?", [sessionId])!;
  const sessionRecord = mapSession(sessionRow);

  if (isSupabaseConfigured()) {
    try {
      await persistToSupabase("guard_shift_sessions", {
        id: sessionRecord.id,
        assignment_id: sessionRecord.assignmentId,
        guard_id: sessionRecord.guardId,
        guard_name: sessionRecord.guardName,
        gate: sessionRecord.gate,
        actual_start: sessionRecord.actualStart,
        checkin_status: sessionRecord.checkinStatus,
        late_minutes: sessionRecord.lateMinutes,
        late_reason: sessionRecord.lateReason,
        notes: sessionRecord.notes,
        status: sessionRecord.status,
        created_at: sessionRecord.createdAt,
        updated_at: sessionRecord.updatedAt,
      });

      await persistToSupabase("guard_shift_assignments", {
        id: updatedAssignment.id,
        status: updatedAssignment.status,
        updated_at: updatedAssignment.updatedAt,
      }, "update");

      await persistToSupabase("security_guards", {
        id: assignment.guardId,
        status: "On Duty",
        assigned_gate: assignment.gate,
        updated_at: nowIso,
      }, "update");
    } catch (err) {
      console.error("[guard-duty] Supabase sync failed on startShift:", err);
    }
  }

  return { assignment: updatedAssignment, session: sessionRecord };
}

export interface EndShiftInput {
  sessionId: string;
  shiftSummary?: string;
  notes?: string;
  equipmentDetails?: EquipmentHandoverItem[];
  incomingGuardId?: string;
  urgentIssues?: string;
  generalNotes?: string;
}

export async function endGuardShift(
  input: EndShiftInput,
  actor: AuthSession,
): Promise<{ session: GuardShiftSession; handover: ShiftHandover }> {
  const sessionRow = get<Row>("SELECT * FROM guard_shift_sessions WHERE id = ?", [input.sessionId]);
  if (!sessionRow) throw notFound("Shift session not found.");
  const currentSession = mapSession(sessionRow);

  if (currentSession.status === "Completed") {
    throw conflict("This shift session has already ended.");
  }

  // Authorization: Guards can only end their own shift unless supervisor/admin
  if (actor.role === "security" && actor.refId && actor.refId !== currentSession.guardId) {
    throw forbidden("You can only check out of your own shift session.");
  }

  const nowIso = new Date().toISOString();
  const handoverId = nextId("HND", { pad: 4 });

  // 1. Gather live pending visitors (checked in, not yet checked out)
  const pendingVisitors = all<Row>(
    `SELECT id, full_name, mobile, host_name, check_in_at, gate, expected_departure_time, notes
       FROM visit_requests
      WHERE status IN ('Checked In', 'Meeting In Progress') AND gate = ?`,
    [currentSession.gate],
  );

  // 2. Gather live open incidents
  const openIncidents = all<Row>(
    `SELECT id, title, severity, location, status, description
       FROM incidents
      WHERE status IN ('Open', 'Investigating')`,
  );

  // 3. Gather patrol checkpoint status
  const totalCheckpoints = Number(get<{ c: number }>("SELECT COUNT(*) AS c FROM patrol_checkpoints WHERE active = 1")?.c || 0);
  const completedPatrols = Number(
    get<{ c: number }>("SELECT COUNT(DISTINCT checkpoint_id) AS c FROM patrol_submissions WHERE session_id = ?", [
      currentSession.id,
    ])?.c || 0,
  );

  let incomingGuardName = "";
  if (input.incomingGuardId) {
    const inc = get<Row>("SELECT full_name FROM security_guards WHERE id = ?", [input.incomingGuardId]);
    if (inc) incomingGuardName = String(inc.full_name);
  }

  const handoverStatus: HandoverStatus = input.incomingGuardId ? "Awaiting Incoming Guard" : "Submitted";

  tx(() => {
    // A. Update guard shift session to Handover Pending
    run(
      `UPDATE guard_shift_sessions
          SET actual_end = ?, status = 'Handover Pending', notes = COALESCE(?, notes), updated_at = ?
        WHERE id = ?`,
      [nowIso, input.notes || input.shiftSummary || null, nowIso, currentSession.id],
    );

    // B. Mark assignment as Completed
    run(
      `UPDATE guard_shift_assignments
          SET status = 'Completed', updated_at = ?
        WHERE id = ?`,
      [nowIso, currentSession.assignmentId],
    );

    // C. Set security guard to Active (Off duty)
    run(
      `UPDATE security_guards
          SET status = 'Active', updated_at = ?
        WHERE id = ?`,
      [nowIso, currentSession.guardId],
    );

    // D. Create shift handover master record
    run(
      `INSERT INTO shift_handovers
         (id, session_id, outgoing_guard_id, outgoing_guard_name, incoming_guard_id, incoming_guard_name,
          gate, duty_date, shift_type, status, equipment_details, general_notes, urgent_issues,
          pending_visitors_count, open_incidents_count, patrol_completed_count, patrol_total_count,
          submitted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        handoverId,
        currentSession.id,
        currentSession.guardId,
        currentSession.guardName,
        input.incomingGuardId || null,
        incomingGuardName,
        currentSession.gate,
        todayInCampusTz(),
        "General",
        handoverStatus,
        JSON.stringify(input.equipmentDetails || []),
        input.generalNotes || input.shiftSummary || "",
        input.urgentIssues || "",
        pendingVisitors.length,
        openIncidents.length,
        completedPatrols,
        totalCheckpoints,
        nowIso,
        nowIso,
        nowIso,
      ],
    );

    // E. Insert itemized handover review items for visitors and incidents
    for (const v of pendingVisitors) {
      run(
        `INSERT INTO shift_handover_items
           (id, handover_id, category, reference_id, title, severity_or_status, notes, created_at)
         VALUES (?, ?, 'Visitor', ?, ?, 'Inside', ?, ?)`,
        [
          nextId("HI", { pad: 5 }),
          handoverId,
          toText(v.id),
          `${v.full_name} (Host: ${v.host_name || "N/A"})`,
          v.expected_departure_time ? `Expected out: ${v.expected_departure_time}` : "Awaiting check-out",
          nowIso,
        ],
      );
    }

    for (const inc of openIncidents) {
      run(
        `INSERT INTO shift_handover_items
           (id, handover_id, category, reference_id, title, severity_or_status, notes, created_at)
         VALUES (?, ?, 'Incident', ?, ?, ?, ?, ?)`,
        [
          nextId("HI", { pad: 5 }),
          handoverId,
          toText(inc.id),
          toText(inc.title),
          toText(inc.severity),
          inc.location ? `Location: ${inc.location}` : "Open investigation",
          nowIso,
        ],
      );
    }

    audit(actor, {
      action: "guard.shift.ended",
      entity: "shift_handover",
      entityId: handoverId,
      summary: `Guard ${currentSession.guardName} ended shift at ${currentSession.gate} and submitted handover ${handoverId}`,
    });

    notify({
      type: "gate",
      title: "Shift Handover Submitted",
      message: `Guard ${currentSession.guardName} submitted handover for ${currentSession.gate} (${pendingVisitors.length} visitors inside, ${openIncidents.length} open incidents).`,
      href: "/admin/guard-duty",
    });
  });

  const updatedSession = mapSession(get<Row>("SELECT * FROM guard_shift_sessions WHERE id = ?", [currentSession.id])!);
  const handoverRecord = mapHandover(get<Row>("SELECT * FROM shift_handovers WHERE id = ?", [handoverId])!);

  if (isSupabaseConfigured()) {
    try {
      await persistToSupabase("guard_shift_sessions", {
        id: updatedSession.id,
        actual_end: updatedSession.actualEnd,
        status: updatedSession.status,
        updated_at: updatedSession.updatedAt,
      }, "update");

      await persistToSupabase("guard_shift_assignments", {
        id: currentSession.assignmentId,
        status: "Completed",
        updated_at: nowIso,
      }, "update");

      await persistToSupabase("security_guards", {
        id: currentSession.guardId,
        status: "Active",
        updated_at: nowIso,
      }, "update");

      await persistToSupabase("shift_handovers", {
        id: handoverRecord.id,
        session_id: handoverRecord.sessionId,
        outgoing_guard_id: handoverRecord.outgoingGuardId,
        outgoing_guard_name: handoverRecord.outgoingGuardName,
        incoming_guard_id: handoverRecord.incomingGuardId,
        incoming_guard_name: handoverRecord.incomingGuardName,
        gate: handoverRecord.gate,
        duty_date: handoverRecord.dutyDate,
        shift_type: handoverRecord.shiftType,
        status: handoverRecord.status,
        equipment_details: handoverRecord.equipmentDetails,
        general_notes: handoverRecord.generalNotes,
        urgent_issues: handoverRecord.urgentIssues,
        pending_visitors_count: handoverRecord.pendingVisitorsCount,
        open_incidents_count: handoverRecord.openIncidentsCount,
        patrol_completed_count: handoverRecord.patrolCompletedCount,
        patrol_total_count: handoverRecord.patrolTotalCount,
        submitted_at: handoverRecord.submittedAt,
        created_at: handoverRecord.createdAt,
        updated_at: handoverRecord.updatedAt,
      });
    } catch (err) {
      console.error("[guard-duty] Supabase sync failed on endShift:", err);
    }
  }

  return { session: updatedSession, handover: handoverRecord };
}

/* ------------------------------------------------------------------ *
 * Shift Handover Workflow (Acknowledge & Decision)
 * ------------------------------------------------------------------ */

export function getHandoverDetails(handoverId: string): {
  handover: ShiftHandover;
  items: ShiftHandoverItem[];
} {
  const row = get<Row>("SELECT * FROM shift_handovers WHERE id = ?", [handoverId]);
  if (!row) throw notFound("Shift handover not found.");

  const itemRows = all<Row>("SELECT * FROM shift_handover_items WHERE handover_id = ? ORDER BY category, created_at", [
    handoverId,
  ]);

  const items: ShiftHandoverItem[] = itemRows.map((ir) => ({
    id: String(ir.id),
    handoverId: String(ir.handover_id),
    category: ir.category as any,
    referenceId: String(ir.reference_id),
    title: String(ir.title),
    severityOrStatus: String(ir.severity_or_status || ""),
    notes: String(ir.notes || ""),
    acknowledgedByIncoming: Boolean(ir.acknowledged_by_incoming),
    createdAt: String(ir.created_at),
  }));

  return { handover: mapHandover(row), items };
}

export async function acknowledgeHandover(
  handoverId: string,
  input: { incomingNotes?: string; disputedItems?: string; itemAcks?: string[] },
  actor: AuthSession,
): Promise<ShiftHandover> {
  const current = get<Row>("SELECT * FROM shift_handovers WHERE id = ?", [handoverId]);
  if (!current) throw notFound("Shift handover not found.");

  // Validation: Only incoming guard or supervisor/admin can acknowledge
  if (
    actor.role === "security" &&
    current.incoming_guard_id &&
    actor.refId &&
    actor.refId !== current.incoming_guard_id
  ) {
    throw forbidden("Only the designated incoming guard can acknowledge this handover.");
  }

  const nowIso = new Date().toISOString();

  tx(() => {
    run(
      `UPDATE shift_handovers
          SET status = 'Pending Supervisor Review',
              incoming_acknowledged_at = ?,
              incoming_notes = ?,
              disputed_items = ?,
              updated_at = ?
        WHERE id = ?`,
      [nowIso, input.incomingNotes || null, input.disputedItems || null, nowIso, handoverId],
    );

    // If specific item acks provided, mark them
    if (input.itemAcks && input.itemAcks.length > 0) {
      for (const itemId of input.itemAcks) {
        run(`UPDATE shift_handover_items SET acknowledged_by_incoming = 1 WHERE id = ? AND handover_id = ?`, [
          itemId,
          handoverId,
        ]);
      }
    } else {
      run(`UPDATE shift_handover_items SET acknowledged_by_incoming = 1 WHERE handover_id = ?`, [handoverId]);
    }

    audit(actor, {
      action: "handover.acknowledged",
      entity: "shift_handover",
      entityId: handoverId,
      summary: `${actor.name} acknowledged shift handover ${handoverId}${input.disputedItems ? ` (Disputes: ${input.disputedItems})` : ""}`,
    });

    notify({
      type: "gate",
      title: "Handover Awaiting Supervisor Review",
      message: `Shift handover ${handoverId} at ${current.gate} has been acknowledged and is ready for approval.`,
      href: "/admin/guard-duty",
    });
  });

  const updated = mapHandover(get<Row>("SELECT * FROM shift_handovers WHERE id = ?", [handoverId])!);

  persistSecondaryToSupabase("shift_handovers", {
    id: updated.id,
    status: updated.status,
    incoming_acknowledged_at: updated.incomingAcknowledgedAt,
    incoming_notes: updated.incomingNotes,
    disputed_items: updated.disputedItems,
    updated_at: updated.updatedAt,
  }, "update");

  return updated;
}

export async function decideHandover(
  handoverId: string,
  decision: "Approved" | "Rejected" | "Escalated",
  input: { notes?: string; rejectionReason?: string },
  actor: AuthSession,
): Promise<ShiftHandover> {
  const current = get<Row>("SELECT * FROM shift_handovers WHERE id = ?", [handoverId]);
  if (!current) throw notFound("Shift handover not found.");

  if (decision === "Rejected" && (!input.rejectionReason || !input.rejectionReason.trim())) {
    throw badRequest("A mandatory rejection reason is required when rejecting a handover.");
  }

  const nowIso = new Date().toISOString();
  const nextStatus: HandoverStatus =
    decision === "Approved" ? "Approved" : decision === "Rejected" ? "Rejected" : "Escalated";

  tx(() => {
    run(
      `UPDATE shift_handovers
          SET status = ?,
              supervisor_id = ?,
              supervisor_name = ?,
              supervisor_decision = ?,
              supervisor_notes = ?,
              rejection_reason = ?,
              decided_at = ?,
              updated_at = ?
        WHERE id = ?`,
      [
        nextStatus,
        actor.userId,
        actor.name,
        decision,
        input.notes || null,
        decision === "Rejected" ? (input.rejectionReason ?? null) : null,
        nowIso,
        nowIso,
        handoverId,
      ],
    );

    // If approved, mark session as Completed
    if (decision === "Approved") {
      run(`UPDATE guard_shift_sessions SET status = 'Completed', updated_at = ? WHERE id = ?`, [
        nowIso,
        toText(current.session_id),
      ]);
    } else if (decision === "Rejected") {
      run(`UPDATE guard_shift_sessions SET status = 'Exception', updated_at = ? WHERE id = ?`, [
        nowIso,
        toText(current.session_id),
      ]);
    }

    audit(actor, {
      action: `handover.${decision.toLowerCase()}`,
      entity: "shift_handover",
      entityId: handoverId,
      summary: `Supervisor ${actor.name} ${decision.toLowerCase()} handover ${handoverId}${decision === "Rejected" ? `: ${input.rejectionReason}` : ""}`,
    });

    notify({
      type: "gate",
      title: `Handover ${decision}`,
      message: `Supervisor ${actor.name} ${decision.toLowerCase()} handover ${handoverId} for ${current.gate}.`,
      href: "/admin/guard-duty",
    });
  });

  const updated = mapHandover(get<Row>("SELECT * FROM shift_handovers WHERE id = ?", [handoverId])!);

  persistSecondaryToSupabase("shift_handovers", {
    id: updated.id,
    status: updated.status,
    supervisor_id: updated.supervisorId,
    supervisor_name: updated.supervisorName,
    supervisor_decision: updated.supervisorDecision,
    supervisor_notes: updated.supervisorNotes,
    rejection_reason: updated.rejectionReason,
    decided_at: updated.decidedAt,
    updated_at: updated.updatedAt,
  }, "update");

  return updated;
}

export function listHandovers(filters: {
  date?: string;
  gate?: string;
  status?: string;
  guardId?: string;
}): ShiftHandover[] {
  let sql = "SELECT * FROM shift_handovers WHERE 1=1";
  const params: unknown[] = [];

  if (filters.date) {
    sql += " AND duty_date = ?";
    params.push(filters.date);
  }
  if (filters.gate) {
    sql += " AND gate = ?";
    params.push(filters.gate);
  }
  if (filters.status) {
    sql += " AND status = ?";
    params.push(filters.status);
  }
  if (filters.guardId) {
    sql += " AND (outgoing_guard_id = ? OR incoming_guard_id = ?)";
    params.push(filters.guardId, filters.guardId);
  }

  sql += " ORDER BY created_at DESC";
  const rows = all(sql, params as any[]);
  return rows.map(mapHandover);
}

/* ------------------------------------------------------------------ *
 * Patrol Routes & Checkpoint Checklist
 * ------------------------------------------------------------------ */

export function getPatrolRoutes(): PatrolRoute[] {
  const rows = all<Row>("SELECT * FROM patrol_routes WHERE active = 1 ORDER BY name");
  return rows.map((r) => {
    let gates: string[] = [];
    try {
      gates = r.applicable_gates ? JSON.parse(String(r.applicable_gates)) : [];
    } catch {
      gates = [];
    }
    return {
      id: String(r.id),
      name: String(r.name),
      zone: String(r.zone),
      applicableGates: gates,
      frequencyHours: Number(r.frequency_hours),
      active: Boolean(r.active),
      createdAt: String(r.created_at),
    };
  });
}

export function getCheckpointsForRoute(routeId: string): PatrolCheckpoint[] {
  const rows = all<Row>("SELECT * FROM patrol_checkpoints WHERE route_id = ? AND active = 1 ORDER BY order_index ASC", [
    routeId,
  ]);
  return rows.map(mapCheckpoint);
}

export function getAllCheckpoints(): (PatrolCheckpoint & { routeName: string })[] {
  const rows = all<Row>(
    `SELECT pc.*, pr.name AS route_name
       FROM patrol_checkpoints pc
       JOIN patrol_routes pr ON pr.id = pc.route_id
      WHERE pc.active = 1
      ORDER BY pr.name, pc.order_index ASC`,
  );
  return rows.map((r) => ({
    ...mapCheckpoint(r),
    routeName: String(r.route_name),
  }));
}

export async function submitPatrolCheck(
  input: {
    sessionId: string;
    checkpointId: string;
    status: "Pass" | "Fail" | "N/A";
    observations?: string;
    photoUrl?: string;
    itemsChecked?: Record<string, "Pass" | "Fail" | "N/A">;
  },
  actor: AuthSession,
): Promise<PatrolSubmission> {
  const sessionRow = get<Row>("SELECT * FROM guard_shift_sessions WHERE id = ?", [input.sessionId]);
  if (!sessionRow) throw notFound("Shift session not found.");
  const currentSession = mapSession(sessionRow);

  const checkpointRow = get<Row>("SELECT * FROM patrol_checkpoints WHERE id = ?", [input.checkpointId]);
  if (!checkpointRow) throw notFound("Patrol checkpoint not found.");
  const chk = mapCheckpoint(checkpointRow);

  if (chk.photoRequired && !input.photoUrl) {
    throw badRequest("A photograph of this checkpoint is required for submission.");
  }

  // Prevent duplicate submission for this session + checkpoint
  const existing = get<Row>("SELECT id FROM patrol_submissions WHERE session_id = ? AND checkpoint_id = ?", [
    input.sessionId,
    input.checkpointId,
  ]);
  if (existing) {
    throw conflict("This checkpoint has already been inspected for the current shift.");
  }

  const id = nextId("PAT", { pad: 4 });
  const nowIso = new Date().toISOString();
  const isCriticalFailure = input.status === "Fail";

  tx(() => {
    run(
      `INSERT INTO patrol_submissions
         (id, session_id, checkpoint_id, guard_id, guard_name, status, observations,
          photo_url, items_checked, escalated, escalation_notes, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        currentSession.id,
        chk.id,
        currentSession.guardId,
        currentSession.guardName,
        input.status,
        input.observations || "",
        input.photoUrl || null,
        JSON.stringify(input.itemsChecked || {}),
        isCriticalFailure ? 1 : 0,
        isCriticalFailure ? `Critical checkpoint failure at ${chk.title}: ${input.observations || "Inspection failed"}` : null,
        nowIso,
      ],
    );

    audit(actor, {
      action: "patrol.checkpoint.submitted",
      entity: "patrol_submission",
      entityId: id,
      summary: `Guard ${currentSession.guardName} inspected checkpoint ${chk.title}: ${input.status}`,
    });

    if (isCriticalFailure) {
      notify({
        type: "incident",
        title: "Patrol Checkpoint Failure Escalated",
        message: `Guard ${currentSession.guardName} reported failure at checkpoint "${chk.title}" (${chk.location}).`,
        href: "/admin/guard-duty",
      });
    }
  });

  const row = get<Row>(
    `SELECT ps.*, pc.title AS checkpoint_title, pc.location AS checkpoint_location
       FROM patrol_submissions ps
       JOIN patrol_checkpoints pc ON pc.id = ps.checkpoint_id
      WHERE ps.id = ?`,
    [id],
  )!;

  const submission = mapSubmission(row);

  persistSecondaryToSupabase("patrol_submissions", {
    id: submission.id,
    session_id: submission.sessionId,
    checkpoint_id: submission.checkpointId,
    guard_id: submission.guardId,
    guard_name: submission.guardName,
    status: submission.status,
    observations: submission.observations,
    photo_url: submission.photoUrl,
    items_checked: submission.itemsChecked,
    escalated: submission.escalated,
    escalation_notes: submission.escalationNotes,
    submitted_at: submission.submittedAt,
  });

  return submission;
}

export function listPatrolSubmissions(filters: {
  sessionId?: string;
  checkpointId?: string;
  guardId?: string;
  status?: string;
}): PatrolSubmission[] {
  let sql = `
    SELECT ps.*, pc.title AS checkpoint_title, pc.location AS checkpoint_location
      FROM patrol_submissions ps
      JOIN patrol_checkpoints pc ON pc.id = ps.checkpoint_id
     WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters.sessionId) {
    sql += " AND ps.session_id = ?";
    params.push(filters.sessionId);
  }
  if (filters.checkpointId) {
    sql += " AND ps.checkpoint_id = ?";
    params.push(filters.checkpointId);
  }
  if (filters.guardId) {
    sql += " AND ps.guard_id = ?";
    params.push(filters.guardId);
  }
  if (filters.status) {
    sql += " AND ps.status = ?";
    params.push(filters.status);
  }

  sql += " ORDER BY ps.submitted_at DESC";
  const rows = all(sql, params as any[]);
  return rows.map(mapSubmission);
}

/* ------------------------------------------------------------------ *
 * Live Handover Data Feed (Pending Visitors & Unresolved Incidents)
 * ------------------------------------------------------------------ */

export function getLiveHandoverData(gate?: string) {
  let vSql = `SELECT id, full_name, mobile, host_name, check_in_at, gate, expected_departure_time, notes, visitor_type
               FROM visit_requests
              WHERE status IN ('Checked In', 'Meeting In Progress')`;
  const vParams: unknown[] = [];
  if (gate) {
    vSql += " AND gate = ?";
    vParams.push(gate);
  }
  vSql += " ORDER BY check_in_at ASC";

  const visitors = all<Row>(vSql, vParams as any[]);

  const incidents = all<Row>(
    `SELECT id, title, severity, location, status, date, time, description, reported_by, assigned_to_name
       FROM incidents
      WHERE status IN ('Open', 'Investigating')
      ORDER BY CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, date DESC`,
  );

  return { visitors, incidents };
}

/* ------------------------------------------------------------------ *
 * Reports & Audit
 * ------------------------------------------------------------------ */

export function getShiftAndPatrolReports(filters: { fromDate?: string; toDate?: string; gate?: string }) {
  const from = filters.fromDate || todayInCampusTz(-7);
  const to = filters.toDate || todayInCampusTz();

  const totalAssigned = Number(
    get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM guard_shift_assignments WHERE duty_date BETWEEN ? AND ?",
      [from, to],
    )?.c || 0,
  );

  const completedShifts = Number(
    get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM guard_shift_assignments WHERE duty_date BETWEEN ? AND ? AND status = 'Completed'",
      [from, to],
    )?.c || 0,
  );

  const lateCheckins = Number(
    get<{ c: number }>(
      `SELECT COUNT(*) AS c
         FROM guard_shift_sessions s
         JOIN guard_shift_assignments a ON a.id = s.assignment_id
        WHERE a.duty_date BETWEEN ? AND ? AND s.checkin_status = 'Late'`,
      [from, to],
    )?.c || 0,
  );

  const totalPatrols = Number(
    get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM patrol_submissions WHERE submitted_at BETWEEN ? AND ?",
      [`${from}T00:00:00`, `${to}T23:59:59`],
    )?.c || 0,
  );

  const failedPatrols = Number(
    get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM patrol_submissions WHERE status = 'Fail' AND submitted_at BETWEEN ? AND ?",
      [`${from}T00:00:00`, `${to}T23:59:59`],
    )?.c || 0,
  );

  const approvedHandovers = Number(
    get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM shift_handovers WHERE status = 'Approved' AND duty_date BETWEEN ? AND ?",
      [from, to],
    )?.c || 0,
  );

  const rejectedHandovers = Number(
    get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM shift_handovers WHERE status = 'Rejected' AND duty_date BETWEEN ? AND ?",
      [from, to],
    )?.c || 0,
  );

  return {
    period: { from, to },
    metrics: {
      totalAssigned,
      completedShifts,
      lateCheckins,
      completionRate: totalAssigned > 0 ? Math.round((completedShifts / totalAssigned) * 100) : 100,
      totalPatrols,
      failedPatrols,
      patrolPassRate: totalPatrols > 0 ? Math.round(((totalPatrols - failedPatrols) / totalPatrols) * 100) : 100,
      approvedHandovers,
      rejectedHandovers,
    },
    staffingGaps: getGateStaffingStatus(to).filter((s) => s.isUnderstaffed),
  };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function toMinutes(hhmm: string): number {
  if (!hhmm) return 0;
  const parts = hhmm.split(":");
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}
