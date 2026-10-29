import "server-only";

import type {
  AuthSession,
  EmergencyIncident,
  IncidentAssignment,
  IncidentEvent,
  IncidentEventType,
  IncidentSeverity,
  SOSCategory,
  SOSStatus,
} from "@/lib/types";
import { all, get, nextId, run, tx, type SqlValue } from "../db";
import type { Row } from "../db";
import { audit, notify } from "../audit";
import { publish } from "../events";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { findGuard } from "../repo";

/**
 * Emergency SOS — Full lifecycle incident management with guard dispatch.
 *
 * Status machine (server-enforced):
 *   REPORTED → ACKNOWLEDGED → ASSIGNED → RESPONDING → ON_SCENE → RESOLVED → CLOSED
 *   Any → CANCELLED (admin only)
 *   Any → ESCALATED (system or admin)
 *
 * Guard dispatch:
 *   On creation, system identifies eligible on-duty guards and assigns the
 *   best available one. If none available, incident is left REPORTED and
 *   admin is notified.
 *
 * Acknowledgement timer:
 *   24 minutes for Critical, 30 min for High, 45 min for Medium/Low.
 *   Detected by /api/sos/escalation-check (call from cron or scheduled invocation).
 */

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * Permitted transitions per role
 * ------------------------------------------------------------------ */

const ALLOWED_TRANSITIONS: Record<string, Record<SOSStatus, SOSStatus[]>> = {
  admin: {
    REPORTED: ["ACKNOWLEDGED", "ASSIGNED", "CANCELLED", "ESCALATED"],
    ACKNOWLEDGED: ["ASSIGNED", "CANCELLED", "ESCALATED"],
    ASSIGNED: ["RESPONDING", "CANCELLED", "ESCALATED"],
    RESPONDING: ["ON_SCENE", "ESCALATED"],
    ON_SCENE: ["RESOLVED", "ESCALATED"],
    RESOLVED: ["CLOSED"],
    CLOSED: [],
    CANCELLED: [],
    ESCALATED: ["ASSIGNED", "CANCELLED", "CLOSED"],
  },
  super_admin: {
    REPORTED: ["ACKNOWLEDGED", "ASSIGNED", "CANCELLED", "ESCALATED"],
    ACKNOWLEDGED: ["ASSIGNED", "CANCELLED", "ESCALATED"],
    ASSIGNED: ["RESPONDING", "CANCELLED", "ESCALATED"],
    RESPONDING: ["ON_SCENE", "ESCALATED"],
    ON_SCENE: ["RESOLVED", "ESCALATED"],
    RESOLVED: ["CLOSED"],
    CLOSED: [],
    CANCELLED: [],
    ESCALATED: ["ASSIGNED", "CANCELLED", "CLOSED"],
  },
  security: {
    REPORTED: ["ACKNOWLEDGED"],
    ACKNOWLEDGED: ["RESPONDING"],
    ASSIGNED: ["ACKNOWLEDGED", "RESPONDING"],
    RESPONDING: ["ON_SCENE"],
    ON_SCENE: ["RESOLVED"],
    RESOLVED: [],
    CLOSED: [],
    CANCELLED: [],
    ESCALATED: ["ACKNOWLEDGED", "RESPONDING"],
  },
};

/** ACK deadline in minutes per severity */
const ACK_DEADLINE_MINUTES: Record<IncidentSeverity, number> = {
  Critical: 5,
  High: 10,
  Medium: 20,
  Low: 30,
};

/* ------------------------------------------------------------------ *
 * Row mappers
 * ------------------------------------------------------------------ */

function mapIncident(r: Row): EmergencyIncident {
  return {
    id: String(r.id),
    reporterId: r.reporter_id ? String(r.reporter_id) : null,
    reporterName: String(r.reporter_name),
    reporterRole: String(r.reporter_role || "security"),
    reporterContact: String(r.reporter_contact || ""),
    category: String(r.category) as SOSCategory,
    severity: String(r.severity) as IncidentSeverity,
    title: String(r.title || ""),
    description: String(r.description || ""),
    campus: String(r.campus || "Main Campus"),
    building: String(r.building || ""),
    area: String(r.area || ""),
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    evidenceUrl: r.evidence_url ? String(r.evidence_url) : null,
    status: String(r.status) as SOSStatus,
    assignedGuardId: r.assigned_guard_id ? String(r.assigned_guard_id) : null,
    assignedGuardName: r.assigned_guard_name ? String(r.assigned_guard_name) : null,
    assignedAt: r.assigned_at ? String(r.assigned_at) : null,
    reportedAt: String(r.reported_at || r.created_at),
    acknowledgedAt: r.acknowledged_at ? String(r.acknowledged_at) : null,
    dispatchedAt: r.dispatched_at ? String(r.dispatched_at) : null,
    respondingAt: r.responding_at ? String(r.responding_at) : null,
    onSceneAt: r.on_scene_at ? String(r.on_scene_at) : null,
    resolvedAt: r.resolved_at ? String(r.resolved_at) : null,
    closedAt: r.closed_at ? String(r.closed_at) : null,
    resolutionSummary: r.resolution_summary ? String(r.resolution_summary) : null,
    resolvedBy: r.resolved_by ? String(r.resolved_by) : null,
    ackDeadlineAt: r.ack_deadline_at ? String(r.ack_deadline_at) : null,
    escalated: Boolean(r.escalated),
    escalationNote: r.escalation_note ? String(r.escalation_note) : null,
    idempotencyKey: r.idempotency_key ? String(r.idempotency_key) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapEvent(r: Row): IncidentEvent {
  return {
    id: String(r.id),
    incidentId: String(r.incident_id),
    actorId: r.actor_id ? String(r.actor_id) : null,
    actorName: String(r.actor_name),
    actorRole: String(r.actor_role),
    eventType: String(r.event_type) as IncidentEventType,
    oldStatus: r.old_status ? String(r.old_status) : null,
    newStatus: r.new_status ? String(r.new_status) : null,
    note: r.note ? String(r.note) : null,
    at: String(r.at),
  };
}

function mapAssignment(r: Row): IncidentAssignment {
  return {
    id: String(r.id),
    incidentId: String(r.incident_id),
    guardId: String(r.guard_id),
    guardName: String(r.guard_name),
    assignedBy: String(r.assigned_by),
    assignedAt: String(r.assigned_at),
    reason: r.reason ? String(r.reason) : null,
    active: Boolean(r.active),
  };
}

/* ------------------------------------------------------------------ *
 * Finders
 * ------------------------------------------------------------------ */

export function findSosIncident(id: string): EmergencyIncident | null {
  const r = get<Row>("SELECT * FROM emergency_incidents WHERE id = ?", [id]);
  return r ? mapIncident(r) : null;
}

export function listSosIncidents(opts: {
  status?: SOSStatus | SOSStatus[];
  guardId?: string;
  limit?: number;
}): EmergencyIncident[] {
  const conditions: string[] = [];
  const params: SqlValue[] = [];

  if (opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    conditions.push(`status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }
  if (opts.guardId) {
    conditions.push("assigned_guard_id = ?");
    params.push(opts.guardId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;
  const rows = all<Row>(
    `SELECT * FROM emergency_incidents ${where} ORDER BY reported_at DESC LIMIT ?`,
    [...params, limit],
  );
  return rows.map(mapIncident);
}

export function listIncidentEvents(incidentId: string): IncidentEvent[] {
  const rows = all<Row>(
    "SELECT * FROM incident_events WHERE incident_id = ? ORDER BY at ASC",
    [incidentId],
  );
  return rows.map(mapEvent);
}

export function getActiveAssignment(incidentId: string): IncidentAssignment | null {
  const r = get<Row>(
    "SELECT * FROM incident_assignments WHERE incident_id = ? AND active = 1",
    [incidentId],
  );
  return r ? mapAssignment(r) : null;
}

/* ------------------------------------------------------------------ *
 * Create SOS
 * ------------------------------------------------------------------ */

export interface CreateSOSInput {
  category: SOSCategory;
  severity: IncidentSeverity;
  title?: string;
  description?: string;
  campus?: string;
  building?: string;
  area: string;
  latitude?: number | null;
  longitude?: number | null;
  evidenceUrl?: string | null;
  reporterContact?: string;
  idempotencyKey?: string;
}

export function createSosIncident(
  input: CreateSOSInput,
  actor: AuthSession,
): EmergencyIncident {
  // Idempotency check
  if (input.idempotencyKey) {
    const existing = get<Row>(
      "SELECT * FROM emergency_incidents WHERE idempotency_key = ?",
      [input.idempotencyKey],
    );
    if (existing) return mapIncident(existing);
  }

  const timestamp = now();
  const deadlineMinutes = ACK_DEADLINE_MINUTES[input.severity] ?? 30;
  const ackDeadline = new Date(new Date(timestamp).getTime() + deadlineMinutes * 60_000).toISOString();

  const incident = tx(() => {
    const id = nextId("SOS");

    // Attempt auto-dispatch to an on-duty guard
    const eligibleGuard = get<Row>(
      `SELECT * FROM security_guards
       WHERE status IN ('On Duty','Active') LIMIT 1`,
    );

    const assignedGuardId = eligibleGuard ? String(eligibleGuard.id) : null;
    const assignedGuardName = eligibleGuard ? String(eligibleGuard.full_name) : null;
    const initialStatus: SOSStatus = assignedGuardId ? "ASSIGNED" : "REPORTED";

    run(
      `INSERT INTO emergency_incidents
         (id, reporter_id, reporter_name, reporter_role, reporter_contact,
          category, severity, title, description, campus, building, area,
          latitude, longitude, evidence_url, status,
          assigned_guard_id, assigned_guard_name, assigned_at,
          reported_at, ack_deadline_at, idempotency_key, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        actor.userId,
        actor.name,
        actor.role,
        input.reporterContact ?? "",
        input.category,
        input.severity,
        input.title ?? input.category,
        input.description ?? "",
        input.campus ?? "Main Campus",
        input.building ?? "",
        input.area,
        input.latitude ?? null,
        input.longitude ?? null,
        input.evidenceUrl ?? null,
        initialStatus,
        assignedGuardId,
        assignedGuardName,
        assignedGuardId ? timestamp : null,
        timestamp,
        ackDeadline,
        input.idempotencyKey ?? null,
        timestamp,
        timestamp,
      ],
    );

    // Log dispatch assignment
    if (assignedGuardId) {
      const asnId = nextId("ASN");
      run(
        `INSERT INTO incident_assignments (id, incident_id, guard_id, guard_name, assigned_by, assigned_at, active)
         VALUES (?,?,?,?,?,?,1)`,
        [asnId, id, assignedGuardId, assignedGuardName, "system (auto-dispatch)", timestamp],
      );
    }

    // Log creation event
    const evtId = nextId("EVT");
    run(
      `INSERT INTO incident_events (id, incident_id, actor_id, actor_name, actor_role, event_type, new_status, note, at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [evtId, id, actor.userId, actor.name, actor.role, "CREATED", initialStatus,
       assignedGuardId ? `Auto-dispatched to ${assignedGuardName}` : "No guard available — awaiting manual dispatch", timestamp],
    );

    // Notify dashboards
    notify({
      type: "emergency",
      title: `🚨 SOS: ${input.category}`,
      message: `${input.severity} emergency at ${input.area}${input.building ? `, ${input.building}` : ""}. Reported by ${actor.name}.`,
      href: "/admin/sos",
    });

    if (!assignedGuardId) {
      notify({
        type: "emergency",
        title: "No guard available for SOS",
        message: `${id}: ${input.category} at ${input.area} — manual dispatch required.`,
        href: "/admin/sos",
        audience: "admin",
      });
    }

    audit(actor, {
      action: "sos.created",
      entity: "emergency_incident",
      entityId: id,
      summary: `${actor.name} raised ${input.category} SOS (${input.severity}) at ${input.area}.`,
    });

    const created = findSosIncident(id);
    if (!created) throw notFound("The SOS could not be saved.");
    return created;
  });

  publish("sos", "created", incident.id);
  return incident;
}

/* ------------------------------------------------------------------ *
 * Transition status
 * ------------------------------------------------------------------ */

export interface TransitionSOSInput {
  status: SOSStatus;
  note?: string;
  resolutionSummary?: string;
}

export function transitionSosStatus(
  id: string,
  input: TransitionSOSInput,
  actor: AuthSession,
): EmergencyIncident {
  const current = findSosIncident(id);
  if (!current) throw notFound("That SOS incident no longer exists.");

  const roleTransitions = ALLOWED_TRANSITIONS[actor.role]?.[current.status] ?? [];
  if (!roleTransitions.includes(input.status)) {
    throw forbidden(
      `Transition from ${current.status} to ${input.status} is not allowed for role ${actor.role}.`,
    );
  }

  // Guard can only update their assigned incident
  if (
    actor.role === "security" &&
    current.assignedGuardId &&
    current.assignedGuardId !== actor.refId
  ) {
    throw forbidden("This incident is assigned to another guard.");
  }

  const timestamp = now();
  const updated = tx(() => {
    const patchFields: string[] = ["status = ?", "updated_at = ?"];
    const patchValues: SqlValue[] = [input.status, timestamp];

    if (input.status === "ACKNOWLEDGED") {
      patchFields.push("acknowledged_at = COALESCE(acknowledged_at, ?)");
      patchValues.push(timestamp);
    }
    if (input.status === "RESPONDING") {
      patchFields.push("responding_at = COALESCE(responding_at, ?)");
      patchValues.push(timestamp);
    }
    if (input.status === "ON_SCENE") {
      patchFields.push("on_scene_at = COALESCE(on_scene_at, ?)");
      patchValues.push(timestamp);
    }
    if (input.status === "RESOLVED" || input.status === "CLOSED") {
      patchFields.push("resolved_at = COALESCE(resolved_at, ?)");
      patchValues.push(timestamp);
      if (input.resolutionSummary) {
        patchFields.push("resolution_summary = ?");
        patchValues.push(input.resolutionSummary);
        patchFields.push("resolved_by = ?");
        patchValues.push(actor.name);
      }
    }
    if (input.status === "CLOSED") {
      patchFields.push("closed_at = ?");
      patchValues.push(timestamp);
    }
    if (input.status === "ESCALATED") {
      patchFields.push("escalated = 1");
      if (input.note) {
        patchFields.push("escalation_note = ?");
        patchValues.push(input.note);
      }
    }

    run(
      `UPDATE emergency_incidents SET ${patchFields.join(", ")} WHERE id = ?`,
      [...patchValues, id],
    );

    // Log event
    const evtId = nextId("EVT");
    run(
      `INSERT INTO incident_events (id, incident_id, actor_id, actor_name, actor_role, event_type, old_status, new_status, note, at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        evtId, id, actor.userId, actor.name, actor.role,
        "STATUS_CHANGED", current.status, input.status, input.note ?? null, timestamp,
      ],
    );

    audit(actor, {
      action: `sos.${input.status.toLowerCase()}`,
      entity: "emergency_incident",
      entityId: id,
      summary: `${actor.name} moved SOS ${id} from ${current.status} → ${input.status}.`,
    });

    const after = findSosIncident(id);
    if (!after) throw notFound("The incident no longer exists.");
    return after;
  });

  publish("sos", "updated", id);
  return updated;
}

/* ------------------------------------------------------------------ *
 * Guard actions
 * ------------------------------------------------------------------ */

export function addIncidentNote(
  id: string,
  note: string,
  actor: AuthSession,
): IncidentEvent {
  const current = findSosIncident(id);
  if (!current) throw notFound("That SOS incident no longer exists.");
  if (["CLOSED", "CANCELLED"].includes(current.status)) {
    throw conflict("Cannot add notes to a closed or cancelled incident.");
  }
  if (
    actor.role === "security" &&
    current.assignedGuardId &&
    current.assignedGuardId !== actor.refId
  ) {
    throw forbidden("You are not assigned to this incident.");
  }

  const timestamp = now();
  const evtId = nextId("EVT");

  run(
    `INSERT INTO incident_events (id, incident_id, actor_id, actor_name, actor_role, event_type, note, at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [evtId, id, actor.userId, actor.name, actor.role, "NOTE_ADDED", note, timestamp],
  );
  run("UPDATE emergency_incidents SET updated_at = ? WHERE id = ?", [timestamp, id]);

  audit(actor, {
    action: "sos.note_added",
    entity: "emergency_incident",
    entityId: id,
    summary: `${actor.name} added a note to SOS ${id}.`,
  });

  const evt = get<Row>("SELECT * FROM incident_events WHERE id = ?", [evtId]);
  return mapEvent(evt!);
}

export function requestBackup(id: string, note: string, actor: AuthSession): IncidentEvent {
  const current = findSosIncident(id);
  if (!current) throw notFound("That SOS incident no longer exists.");
  if (
    actor.role === "security" &&
    current.assignedGuardId &&
    current.assignedGuardId !== actor.refId
  ) {
    throw forbidden("You are not assigned to this incident.");
  }

  const timestamp = now();
  const evtId = nextId("EVT");

  run(
    `INSERT INTO incident_events (id, incident_id, actor_id, actor_name, actor_role, event_type, note, at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [evtId, id, actor.userId, actor.name, actor.role, "BACKUP_REQUESTED",
     `BACKUP REQUESTED: ${note}`, timestamp],
  );
  run("UPDATE emergency_incidents SET updated_at = ? WHERE id = ?", [timestamp, id]);

  notify({
    type: "emergency",
    title: `Backup requested — SOS ${id}`,
    message: `Guard ${actor.name} needs backup at SOS ${id}. ${note}`,
    href: "/admin/sos",
    audience: "admin",
  });

  audit(actor, {
    action: "sos.backup_requested",
    entity: "emergency_incident",
    entityId: id,
    summary: `${actor.name} requested backup for SOS ${id}: ${note}`,
  });

  const evt = get<Row>("SELECT * FROM incident_events WHERE id = ?", [evtId]);
  return mapEvent(evt!);
}

/* ------------------------------------------------------------------ *
 * Dispatch / reassign
 * ------------------------------------------------------------------ */

export function dispatchGuard(
  id: string,
  guardId: string,
  reason: string | null,
  actor: AuthSession,
): EmergencyIncident {
  if (!["admin", "super_admin"].includes(actor.role)) {
    throw forbidden("Only admins can dispatch guards.");
  }

  const current = findSosIncident(id);
  if (!current) throw notFound("That SOS incident no longer exists.");
  if (["RESOLVED", "CLOSED", "CANCELLED"].includes(current.status)) {
    throw conflict("Cannot dispatch to a closed/resolved/cancelled incident.");
  }

  const guard = findGuard(guardId);
  if (!guard) throw notFound("That guard does not exist.");

  const timestamp = now();
  const updated = tx(() => {
    // Deactivate previous assignment if any
    if (current.assignedGuardId) {
      run(
        "UPDATE incident_assignments SET active = 0 WHERE incident_id = ? AND active = 1",
        [id],
      );
    }

    // New assignment
    const asnId = nextId("ASN");
    run(
      `INSERT INTO incident_assignments (id, incident_id, guard_id, guard_name, assigned_by, assigned_at, reason, active)
       VALUES (?,?,?,?,?,?,?,1)`,
      [asnId, id, guard.id, guard.fullName, actor.name, timestamp, reason ?? null],
    );

    // Update incident
    const newStatus: SOSStatus = "ASSIGNED";
    run(
      `UPDATE emergency_incidents
         SET assigned_guard_id = ?, assigned_guard_name = ?, assigned_at = ?,
             dispatched_at = COALESCE(dispatched_at, ?),
             status = ?, updated_at = ?
       WHERE id = ?`,
      [guard.id, guard.fullName, timestamp, timestamp, newStatus, timestamp, id],
    );

    // Log event
    const evtId = nextId("EVT");
    const eventType: IncidentEventType = current.assignedGuardId ? "REASSIGNED" : "ASSIGNED";
    run(
      `INSERT INTO incident_events (id, incident_id, actor_id, actor_name, actor_role, event_type, old_status, new_status, note, at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [evtId, id, actor.userId, actor.name, actor.role,
       eventType, current.status, newStatus,
       `Dispatched to ${guard.fullName}${reason ? `: ${reason}` : ""}`, timestamp],
    );

    notify({
      type: "emergency",
      title: `SOS dispatch — ${id}`,
      message: `${guard.fullName} dispatched to ${current.category} at ${current.area}.`,
      href: "/security/emergency",
      audience: "security",
    });

    audit(actor, {
      action: "sos.dispatched",
      entity: "emergency_incident",
      entityId: id,
      summary: `${actor.name} dispatched ${guard.fullName} to SOS ${id}.`,
    });

    const after = findSosIncident(id);
    if (!after) throw notFound("Incident no longer exists.");
    return after;
  });

  publish("sos", "dispatched", id);
  return updated;
}

/* ------------------------------------------------------------------ *
 * Escalation check (call from cron-compatible endpoint)
 * ------------------------------------------------------------------ */

export function checkAndEscalate(): { escalated: number; incidents: string[] } {
  const timestamp = now();
  const overdue = all<Row>(
    `SELECT * FROM emergency_incidents
     WHERE status NOT IN ('RESOLVED','CLOSED','CANCELLED','ESCALATED')
       AND ack_deadline_at IS NOT NULL
       AND ack_deadline_at < ?
       AND escalated = 0`,
    [timestamp],
  );

  const escalatedIds: string[] = [];
  for (const row of overdue) {
    const id = String(row.id);
    tx(() => {
      run(
        `UPDATE emergency_incidents
           SET escalated = 1, escalation_note = 'Auto-escalated: acknowledgement deadline exceeded',
               status = 'ESCALATED', updated_at = ?
         WHERE id = ?`,
        [timestamp, id],
      );

      const evtId = nextId("EVT");
      run(
        `INSERT INTO incident_events (id, incident_id, actor_id, actor_name, actor_role, event_type, old_status, new_status, note, at)
         VALUES (?,?,NULL,'system','system','ESCALATED',?,?,?,?)`,
        [evtId, id, String(row.status), "ESCALATED",
         "Auto-escalated: no acknowledgement within deadline", timestamp],
      );

      notify({
        type: "emergency",
        title: `ESCALATED: SOS ${id}`,
        message: `Emergency incident ${id} (${String(row.category)}) has been auto-escalated. No guard acknowledged within the required time.`,
        href: "/admin/sos",
        audience: "admin",
      });
    });
    escalatedIds.push(id);
  }

  return { escalated: escalatedIds.length, incidents: escalatedIds };
}
