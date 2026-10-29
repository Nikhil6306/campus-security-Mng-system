import "server-only";

import type {
  AuthSession,
  IncidentSeverity,
  MaintenanceEvent,
  MaintenanceEventType,
  SafetyIssue,
  SafetyIssueCategory,
  SafetyIssueStatus,
  SafetyUrgency,
} from "@/lib/types";
import { all, get, nextId, run, tx, type SqlValue } from "../db";
import type { Row } from "../db";
import { audit, notify } from "../audit";
import { publish } from "../events";
import { conflict, forbidden, notFound } from "../errors";

/**
 * Campus Safety Issues & Maintenance Workflow.
 *
 * Status machine:
 *   REPORTED → TRIAGED → ASSIGNED → IN_PROGRESS → FIXED → VERIFIED → CLOSED
 *   Any → REOPENED (admin/supervisor)
 *   Any → ESCALATED (system or admin)
 *
 * Critical issues trigger immediate admin notification.
 * Auto-close is NOT permitted; only authorized verifiers can close.
 */

const now = () => new Date().toISOString();

/** SLA deadlines in hours per severity */
const SLA_HOURS: Record<IncidentSeverity, number> = {
  Critical: 4,
  High: 24,
  Medium: 72,
  Low: 168,
};

/* ------------------------------------------------------------------ *
 * Row mappers
 * ------------------------------------------------------------------ */

function mapIssue(r: Row): SafetyIssue {
  return {
    id: String(r.id),
    category: String(r.category) as SafetyIssueCategory,
    title: String(r.title),
    description: String(r.description || ""),
    campus: String(r.campus || "Main Campus"),
    building: String(r.building || ""),
    area: String(r.area || ""),
    severity: String(r.severity) as IncidentSeverity,
    urgency: String(r.urgency || "Normal") as SafetyUrgency,
    reporterId: r.reporter_id ? String(r.reporter_id) : null,
    reporterName: String(r.reporter_name),
    reporterRole: String(r.reporter_role || "security"),
    evidenceUrl: r.evidence_url ? String(r.evidence_url) : null,
    assignedToId: r.assigned_to_id ? String(r.assigned_to_id) : null,
    assignedToName: r.assigned_to_name ? String(r.assigned_to_name) : null,
    assignedAt: r.assigned_at ? String(r.assigned_at) : null,
    deadlineAt: r.deadline_at ? String(r.deadline_at) : null,
    status: String(r.status) as SafetyIssueStatus,
    verifiedBy: r.verified_by ? String(r.verified_by) : null,
    verifiedAt: r.verified_at ? String(r.verified_at) : null,
    fixNotes: r.fix_notes ? String(r.fix_notes) : null,
    evidenceFixUrl: r.evidence_fix_url ? String(r.evidence_fix_url) : null,
    closedAt: r.closed_at ? String(r.closed_at) : null,
    closureNote: r.closure_note ? String(r.closure_note) : null,
    parentIssueId: r.parent_issue_id ? String(r.parent_issue_id) : null,
    reopenCount: Number(r.reopen_count || 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapMaintEvent(r: Row): MaintenanceEvent {
  return {
    id: String(r.id),
    issueId: String(r.issue_id),
    actorId: r.actor_id ? String(r.actor_id) : null,
    actorName: String(r.actor_name),
    actorRole: String(r.actor_role),
    eventType: String(r.event_type) as MaintenanceEventType,
    oldStatus: r.old_status ? String(r.old_status) : null,
    newStatus: r.new_status ? String(r.new_status) : null,
    note: r.note ? String(r.note) : null,
    at: String(r.at),
  };
}

/* ------------------------------------------------------------------ *
 * Finders
 * ------------------------------------------------------------------ */

export function findSafetyIssue(id: string): SafetyIssue | null {
  const r = get<Row>("SELECT * FROM safety_issues WHERE id = ?", [id]);
  return r ? mapIssue(r) : null;
}

export function listSafetyIssues(opts: {
  status?: SafetyIssueStatus | SafetyIssueStatus[];
  severity?: IncidentSeverity;
  reporterId?: string;
  assignedToId?: string;
  limit?: number;
} = {}): SafetyIssue[] {
  const conditions: string[] = [];
  const params: SqlValue[] = [];

  if (opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    conditions.push(`status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }
  if (opts.severity) {
    conditions.push("severity = ?");
    params.push(opts.severity);
  }
  if (opts.reporterId) {
    conditions.push("reporter_id = ?");
    params.push(opts.reporterId);
  }
  if (opts.assignedToId) {
    conditions.push("assigned_to_id = ?");
    params.push(opts.assignedToId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;
  const rows = all<Row>(
    `SELECT * FROM safety_issues ${where} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit],
  );
  return rows.map(mapIssue);
}

export function listMaintenanceEvents(issueId: string): MaintenanceEvent[] {
  const rows = all<Row>(
    "SELECT * FROM maintenance_events WHERE issue_id = ? ORDER BY at ASC",
    [issueId],
  );
  return rows.map(mapMaintEvent);
}

/* ------------------------------------------------------------------ *
 * Create safety issue
 * ------------------------------------------------------------------ */

export interface CreateSafetyIssueInput {
  category: SafetyIssueCategory;
  title: string;
  description?: string;
  campus?: string;
  building?: string;
  area: string;
  severity: IncidentSeverity;
  urgency?: SafetyUrgency;
  evidenceUrl?: string | null;
}

export function createSafetyIssue(
  input: CreateSafetyIssueInput,
  actor: AuthSession,
): SafetyIssue {
  const timestamp = now();
  const slaHours = SLA_HOURS[input.severity] ?? 72;
  const deadline = new Date(new Date(timestamp).getTime() + slaHours * 3_600_000).toISOString();

  const issue = tx(() => {
    const id = nextId("ISS");

    run(
      `INSERT INTO safety_issues
         (id, category, title, description, campus, building, area,
          severity, urgency, reporter_id, reporter_name, reporter_role,
          evidence_url, deadline_at, status, reopen_count, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'REPORTED',0,?,?)`,
      [
        id,
        input.category,
        input.title,
        input.description ?? "",
        input.campus ?? "Main Campus",
        input.building ?? "",
        input.area,
        input.severity,
        input.urgency ?? "Normal",
        actor.userId,
        actor.name,
        actor.role,
        input.evidenceUrl ?? null,
        deadline,
        timestamp,
        timestamp,
      ],
    );

    // Log creation event
    const evtId = nextId("EVT");
    run(
      `INSERT INTO maintenance_events (id, issue_id, actor_id, actor_name, actor_role, event_type, new_status, at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [evtId, id, actor.userId, actor.name, actor.role, "CREATED", "REPORTED", timestamp],
    );

    // Critical/Immediate issues → immediate admin notification
    if (input.severity === "Critical" || input.urgency === "Immediate") {
      notify({
        type: "incident",
        title: `⚠️ Critical Safety Issue: ${input.category}`,
        message: `${input.title} at ${input.area}${input.building ? `, ${input.building}` : ""}. Reported by ${actor.name}. Deadline: ${slaHours}h.`,
        href: "/admin/safety",
        audience: "admin",
      });
    }

    audit(actor, {
      action: "safety.created",
      entity: "safety_issue",
      entityId: id,
      summary: `${actor.name} reported ${input.category} at ${input.area}.`,
    });

    const created = findSafetyIssue(id);
    if (!created) throw notFound("The safety issue could not be saved.");
    return created;
  });

  publish("safety", "created", issue.id);
  return issue;
}

/* ------------------------------------------------------------------ *
 * Update / transition
 * ------------------------------------------------------------------ */

export interface UpdateSafetyIssueInput {
  status?: SafetyIssueStatus;
  severity?: IncidentSeverity;
  urgency?: SafetyUrgency;
  assignedToId?: string | null;
  assignedToName?: string | null;
  fixNotes?: string;
  evidenceFixUrl?: string | null;
  closureNote?: string;
  note?: string;
}

/** Permitted transitions per role */
const SAFETY_TRANSITIONS: Record<string, Record<SafetyIssueStatus, SafetyIssueStatus[]>> = {
  admin: {
    REPORTED: ["TRIAGED", "ASSIGNED", "ESCALATED", "CLOSED"],
    TRIAGED: ["ASSIGNED", "ESCALATED"],
    ASSIGNED: ["IN_PROGRESS", "ESCALATED"],
    IN_PROGRESS: ["FIXED", "ESCALATED"],
    FIXED: ["VERIFIED", "REOPENED"],
    VERIFIED: ["CLOSED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["ASSIGNED", "TRIAGED"],
    ESCALATED: ["ASSIGNED", "CLOSED"],
  },
  super_admin: {
    REPORTED: ["TRIAGED", "ASSIGNED", "ESCALATED", "CLOSED"],
    TRIAGED: ["ASSIGNED", "ESCALATED"],
    ASSIGNED: ["IN_PROGRESS", "ESCALATED"],
    IN_PROGRESS: ["FIXED", "ESCALATED"],
    FIXED: ["VERIFIED", "REOPENED"],
    VERIFIED: ["CLOSED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["ASSIGNED", "TRIAGED"],
    ESCALATED: ["ASSIGNED", "CLOSED"],
  },
  security: {
    REPORTED: [],
    TRIAGED: [],
    ASSIGNED: ["IN_PROGRESS"],
    IN_PROGRESS: ["FIXED"],
    FIXED: [],
    VERIFIED: [],
    CLOSED: [],
    REOPENED: ["IN_PROGRESS"],
    ESCALATED: [],
  },
};

export function updateSafetyIssue(
  id: string,
  input: UpdateSafetyIssueInput,
  actor: AuthSession,
): SafetyIssue {
  const current = findSafetyIssue(id);
  if (!current) throw notFound("That safety issue no longer exists.");

  // Validate status transition
  if (input.status && input.status !== current.status) {
    const allowed = SAFETY_TRANSITIONS[actor.role]?.[current.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw forbidden(
        `Role ${actor.role} cannot transition from ${current.status} to ${input.status}.`,
      );
    }
    // Closure requires verification first (except admin force-close)
    if (input.status === "CLOSED" && current.status !== "VERIFIED" && !["admin", "super_admin"].includes(actor.role)) {
      throw conflict("Issue must be verified before it can be closed.");
    }
  }

  const timestamp = now();
  const newStatus = input.status ?? current.status;

  const updated = tx(() => {
    const setClauses: string[] = ["updated_at = ?"];
    const setValues: SqlValue[] = [timestamp];

    if (input.status) { setClauses.push("status = ?"); setValues.push(newStatus); }
    if (input.severity) { setClauses.push("severity = ?"); setValues.push(input.severity); }
    if (input.urgency) { setClauses.push("urgency = ?"); setValues.push(input.urgency); }
    if (input.fixNotes) { setClauses.push("fix_notes = ?"); setValues.push(input.fixNotes); }
    if (input.evidenceFixUrl !== undefined) { setClauses.push("evidence_fix_url = ?"); setValues.push(input.evidenceFixUrl); }
    if (input.closureNote) { setClauses.push("closure_note = ?"); setValues.push(input.closureNote); }

    if (input.assignedToId !== undefined) {
      setClauses.push("assigned_to_id = ?", "assigned_to_name = ?", "assigned_at = COALESCE(assigned_at, ?)");
      setValues.push(input.assignedToId, input.assignedToName ?? "", timestamp);
    }

    if (newStatus === "VERIFIED") {
      setClauses.push("verified_by = ?", "verified_at = ?");
      setValues.push(actor.name, timestamp);
    }
    if (newStatus === "CLOSED") {
      setClauses.push("closed_at = ?");
      setValues.push(timestamp);
    }
    if (newStatus === "REOPENED") {
      setClauses.push("reopen_count = reopen_count + 1");
    }

    run(
      `UPDATE safety_issues SET ${setClauses.join(", ")} WHERE id = ?`,
      [...setValues, id],
    );

    // Log maintenance event
    let evtType: MaintenanceEventType = "NOTE_ADDED";
    if (input.status === "ASSIGNED") evtType = "ASSIGNED";
    else if (input.status === "IN_PROGRESS") evtType = "STARTED";
    else if (input.status === "FIXED") evtType = "MARKED_FIXED";
    else if (input.status === "VERIFIED") evtType = "VERIFIED";
    else if (input.status === "CLOSED") evtType = "CLOSED";
    else if (input.status === "REOPENED") evtType = "REOPENED";
    else if (input.status === "ESCALATED") evtType = "ESCALATED";

    const evtId = nextId("EVT");
    run(
      `INSERT INTO maintenance_events (id, issue_id, actor_id, actor_name, actor_role, event_type, old_status, new_status, note, at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        evtId, id, actor.userId, actor.name, actor.role,
        evtType, current.status, newStatus,
        input.note ?? null, timestamp,
      ],
    );

    if (input.assignedToName && newStatus === "ASSIGNED") {
      notify({
        type: "incident",
        title: `Safety issue assigned: ${current.title}`,
        message: `${current.category} at ${current.area} assigned to ${input.assignedToName}.`,
        href: "/admin/safety",
        audience: "security",
      });
    }

    audit(actor, {
      action: `safety.${newStatus.toLowerCase()}`,
      entity: "safety_issue",
      entityId: id,
      summary: `${actor.name} updated safety issue ${id}: ${current.status} → ${newStatus}.`,
    });

    const after = findSafetyIssue(id);
    if (!after) throw notFound("The safety issue no longer exists.");
    return after;
  });

  publish("safety", "updated", id);
  return updated;
}
