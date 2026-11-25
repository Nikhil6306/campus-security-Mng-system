import "server-only";

import type { AuthSession, GuardActivitySummary, SecurityGuard } from "@/lib/types";
import { all, get, nextId, run, tx } from "../db";
import { audit } from "../audit";
import { publish } from "../events";
import { badRequest, conflict, notFound } from "../errors";
import { findGuard, guardActivity, listGuards, mapCheckLog, mapIncident } from "../repo";
import type { CheckLog, Incident } from "@/lib/types";
import { revokeSessionsFor } from "../auth";
import { hashPassword } from "../password";
import { sendGuardApprovalEmail, sendGuardRejectionEmail } from "./email";
import type { guardSchema } from "../validation";
import type { z } from "zod";

/**
 * Security guard roster.
 *
 * Guard records are the roster; the sign-in accounts that reference them live
 * in `app_users`. Suspending a guard therefore has to do both — flip the roster
 * status and cut any session that guard currently holds, or a suspended guard
 * would keep operating the gate until their cookie expired.
 */

type GuardInput = z.infer<typeof guardSchema>;

const now = () => new Date().toISOString();

export function createGuard(input: GuardInput, actor: AuthSession): SecurityGuard {
  const created = tx(() => {
    const id = nextId("GRD", { pad: 3 });
    const timestamp = now();
    run(
      `INSERT INTO security_guards
         (id, employee_id, full_name, phone, email, photo_url, shift, shift_start, shift_end,
          assigned_gate, status, joining_date, emergency_contact, address, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        input.employeeId.toUpperCase(),
        input.fullName,
        input.phone,
        input.email,
        input.photoUrl ?? null,
        input.shift,
        input.shiftStart,
        input.shiftEnd,
        input.assignedGate,
        input.status,
        input.joiningDate,
        input.emergencyContact,
        input.address,
        timestamp,
        timestamp,
      ],
    );
    audit(actor, {
      action: "guard.created",
      entity: "guard",
      entityId: id,
      summary: `${actor.name} added guard ${input.fullName} (${input.employeeId}) on the ${input.shift} shift at ${input.assignedGate}.`,
    });
    const row = findGuard(id);
    if (!row) throw notFound("The guard record could not be saved.");
    return row;
  });

  publish("guards", "created", created.id);
  return created;
}

export function updateGuard(id: string, input: GuardInput, actor: AuthSession): SecurityGuard {
  const current = findGuard(id);
  if (!current) throw notFound("That guard is not on the roster.");

  const updated = tx(() => {
    run(
      `UPDATE security_guards
          SET employee_id = ?, full_name = ?, phone = ?, email = ?, photo_url = ?, shift = ?,
              shift_start = ?, shift_end = ?, assigned_gate = ?, status = ?, joining_date = ?,
              emergency_contact = ?, address = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.employeeId.toUpperCase(),
        input.fullName,
        input.phone,
        input.email,
        input.photoUrl ?? null,
        input.shift,
        input.shiftStart,
        input.shiftEnd,
        input.assignedGate,
        input.status,
        input.joiningDate,
        input.emergencyContact,
        input.address,
        now(),
        id,
      ],
    );

    // Keep the linked sign-in account's posting in step with the roster.
    run("UPDATE app_users SET gate = ?, name = ?, updated_at = ? WHERE ref_id = ?", [
      input.assignedGate,
      input.fullName,
      now(),
      id,
    ]);

    if (input.status === "Suspended" && current.status !== "Suspended") {
      const account = get<{ id: string }>("SELECT id FROM app_users WHERE ref_id = ?", [id]);
      if (account) {
        run("UPDATE app_users SET active = 0 WHERE id = ?", [account.id]);
        revokeSessionsFor(account.id);
      }
    } else if (input.status !== "Suspended" && current.status === "Suspended") {
      run("UPDATE app_users SET active = 1 WHERE ref_id = ?", [id]);
    }

    audit(actor, {
      action: "guard.updated",
      entity: "guard",
      entityId: id,
      summary:
        input.status !== current.status
          ? `${actor.name} changed guard ${input.fullName}'s status from ${current.status} to ${input.status}.`
          : `${actor.name} updated the record for guard ${input.fullName}.`,
    });

    const row = findGuard(id);
    if (!row) throw notFound("That guard is not on the roster.");
    return row;
  });

  publish("guards", "updated", id);
  return updated;
}

export function deleteGuard(id: string, actor: AuthSession): void {
  const current = findGuard(id);
  if (!current) throw notFound("That guard is not on the roster.");

  const open = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM incidents WHERE assigned_to_id = ? AND status IN ('Open','Investigating')",
    [id],
  );
  if ((open?.c ?? 0) > 0) {
    throw conflict(
      `${current.fullName} has ${open?.c} open incident(s) assigned. Reassign them first.`,
    );
  }

  tx(() => {
    const account = get<{ id: string }>("SELECT id FROM app_users WHERE ref_id = ?", [id]);
    if (account) {
      run("UPDATE app_users SET active = 0, ref_id = NULL, updated_at = ? WHERE id = ?", [
        now(),
        account.id,
      ]);
      revokeSessionsFor(account.id);
    }
    // Gate history keeps the guard's name; the foreign key nulls the id.
    run("DELETE FROM security_guards WHERE id = ?", [id]);
    audit(actor, {
      action: "guard.deleted",
      entity: "guard",
      entityId: id,
      summary: `${actor.name} removed guard ${current.fullName} from the roster.`,
    });
  });

  publish("guards", "deleted", id);
}

/* ------------------------------------------------------------------ *
 * Profile reads
 * ------------------------------------------------------------------ */

export interface GuardProfile {
  guard: SecurityGuard;
  today: GuardActivitySummary;
  lifetime: GuardActivitySummary;
  recentLogs: CheckLog[];
  incidents: Incident[];
  /** Shift attendance derived from gate activity, most recent first. */
  shiftHistory: { date: string; checkIns: number; checkOuts: number; firstAt: string; lastAt: string }[];
}

export function guardProfile(id: string, todayStart: string): GuardProfile | undefined {
  const guard = findGuard(id);
  if (!guard) return undefined;

  const recentLogs = all("SELECT * FROM check_logs WHERE guard_id = ? ORDER BY at DESC LIMIT 50", [
    id,
  ]).map(mapCheckLog);

  const incidents = all(
    "SELECT * FROM incidents WHERE reported_by_id = ? OR assigned_to_id = ? ORDER BY created_at DESC LIMIT 50",
    [id, id],
  ).map(mapIncident);

  const shiftHistory = all<{
    date: string;
    ins: number;
    outs: number;
    first_at: string;
    last_at: string;
  }>(
    `SELECT substr(at, 1, 10) AS date,
            SUM(CASE WHEN direction = 'In' THEN 1 ELSE 0 END)  AS ins,
            SUM(CASE WHEN direction = 'Out' THEN 1 ELSE 0 END) AS outs,
            MIN(at) AS first_at, MAX(at) AS last_at
       FROM check_logs WHERE guard_id = ?
      GROUP BY substr(at, 1, 10)
      ORDER BY date DESC LIMIT 30`,
    [id],
  ).map((r) => ({
    date: r.date,
    checkIns: Number(r.ins ?? 0),
    checkOuts: Number(r.outs ?? 0),
    firstAt: r.first_at,
    lastAt: r.last_at,
  }));

  return {
    guard,
    today: guardActivity(id, todayStart),
    lifetime: guardActivity(id),
    recentLogs,
    incidents,
    shiftHistory,
  };
}

/** Roster plus today's counters — what `/admin/guards` renders. */
export function guardRoster(todayStart: string): {
  guard: SecurityGuard;
  today: GuardActivitySummary;
}[] {
  return listGuards().map((guard) => ({ guard, today: guardActivity(guard.id, todayStart) }));
}

/* ------------------------------------------------------------------ *
 * Guard Registration & Admin Approval Workflow
 * ------------------------------------------------------------------ */

export interface GuardRegistrationInput {
  fullName: string;
  email: string;
  phone: string;
  guardId: string;
  password: string;
  designation?: string;
  assignedGate?: string;
}

export interface GuardRegistrationRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  guard_id: string;
  designation: string;
  assigned_gate: string;
  password_hash: string;
  password_salt: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export function createGuardRegistrationRequest(input: GuardRegistrationInput): GuardRegistrationRow {
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanPhone = input.phone.trim();
  const cleanName = input.fullName.trim();
  const cleanGuardId = (input.guardId.trim() || `GRD-${Date.now().toString().slice(-4)}`).toUpperCase();

  if (!cleanName) throw badRequest("Full name is required.");
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw badRequest("A valid email address is required.");
  }
  if (!cleanPhone || cleanPhone.length < 10) {
    throw badRequest("A valid 10-digit mobile number is required.");
  }
  if (!input.password || input.password.length < 6) {
    throw badRequest("Password must be at least 6 characters.");
  }

  // Check if an account already exists in app_users
  const existingUser = get<{ id: string }>("SELECT id FROM app_users WHERE lower(email) = lower(?)", [cleanEmail]);
  if (existingUser) {
    throw conflict("An account with this email address already exists. Please log in.");
  }

  // Check existing in guard_registration_requests
  const existingReq = get<GuardRegistrationRow>(
    "SELECT * FROM guard_registration_requests WHERE lower(email) = lower(?)",
    [cleanEmail],
  );

  if (existingReq) {
    if (existingReq.status === "PENDING") {
      throw conflict("Your guard registration is already pending administrator approval.");
    }
    if (existingReq.status === "APPROVED") {
      throw conflict("Your guard account has already been approved. Please log in.");
    }
    // If previously REJECTED, allow re-submitting with new details
  }

  const { hash, salt } = hashPassword(input.password);
  const id = existingReq?.id ?? nextId("REQ-GRD", { pad: 4 });
  const timestamp = now();
  const designation = input.designation?.trim() || "Security Guard";
  const assignedGate = input.assignedGate?.trim() || "Main Gate";

  tx(() => {
    run(
      `INSERT INTO guard_registration_requests
         (id, full_name, email, phone, guard_id, designation, assigned_gate,
          password_hash, password_salt, status, rejection_reason, created_at, reviewed_at, reviewed_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(email) DO UPDATE SET
         full_name = excluded.full_name,
         phone = excluded.phone,
         guard_id = excluded.guard_id,
         designation = excluded.designation,
         assigned_gate = excluded.assigned_gate,
         password_hash = excluded.password_hash,
         password_salt = excluded.password_salt,
         status = 'PENDING',
         rejection_reason = NULL,
         created_at = excluded.created_at,
         reviewed_at = NULL,
         reviewed_by = NULL`,
      [
        id,
        cleanName,
        cleanEmail,
        cleanPhone,
        cleanGuardId,
        designation,
        assignedGate,
        hash,
        salt,
        "PENDING",
        null,
        timestamp,
        null,
        null,
      ],
    );
  });

  const created = get<GuardRegistrationRow>(
    "SELECT * FROM guard_registration_requests WHERE id = ?",
    [id],
  );
  if (!created) throw notFound("Failed to create guard registration request.");

  publish("guards", "registration_requested", id);
  return created;
}

export function getGuardRegistrationByEmail(email: string): GuardRegistrationRow | undefined {
  return get<GuardRegistrationRow>(
    "SELECT * FROM guard_registration_requests WHERE lower(email) = lower(?)",
    [email.trim().toLowerCase()],
  );
}

export function listGuardRegistrationRequests(status?: string): GuardRegistrationRow[] {
  if (status && status !== "all") {
    return all<GuardRegistrationRow>(
      "SELECT * FROM guard_registration_requests WHERE status = ? ORDER BY created_at DESC",
      [status],
    );
  }
  return all<GuardRegistrationRow>(
    "SELECT * FROM guard_registration_requests ORDER BY created_at DESC",
  );
}

export interface ApproveGuardOptions {
  gate?: string;
  shift?: "Morning" | "Evening" | "Night" | "General";
  shiftStart?: string;
  shiftEnd?: string;
  designation?: string;
}

export function approveGuardRegistration(
  requestId: string,
  actor: AuthSession,
  options?: ApproveGuardOptions,
): { guard: SecurityGuard; accountId: string } {
  const req = get<GuardRegistrationRow>(
    "SELECT * FROM guard_registration_requests WHERE id = ?",
    [requestId],
  );
  if (!req) throw notFound("Guard registration request not found.");
  if (req.status === "APPROVED") {
    throw conflict("This guard registration has already been approved.");
  }

  const assignedGate = options?.gate?.trim() || req.assigned_gate || "Main Gate";
  const shift = options?.shift || "Morning";
  const shiftStart =
    options?.shiftStart ||
    (shift === "Morning" ? "06:00" : shift === "Evening" ? "14:00" : shift === "Night" ? "22:00" : "08:00");
  const shiftEnd =
    options?.shiftEnd ||
    (shift === "Morning" ? "14:00" : shift === "Evening" ? "22:00" : shift === "Night" ? "06:00" : "17:00");
  const designation = options?.designation?.trim() || req.designation || "Security Guard";

  const result = tx(() => {
    const timestamp = now();
    const guardId = nextId("GRD", { pad: 3 });
    const employeeId = req.guard_id.toUpperCase();

    // 1. Insert or update security_guards roster
    run(
      `INSERT INTO security_guards
         (id, employee_id, full_name, phone, email, photo_url, shift, shift_start, shift_end,
          assigned_gate, status, joining_date, emergency_contact, address, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(employee_id) DO UPDATE SET
         assigned_gate = excluded.assigned_gate,
         status = 'Active',
         updated_at = excluded.updated_at`,
      [
        guardId,
        employeeId,
        req.full_name,
        req.phone,
        req.email,
        null,
        shift,
        shiftStart,
        shiftEnd,
        assignedGate,
        "Active",
        timestamp.slice(0, 10),
        "",
        "",
        timestamp,
        timestamp,
      ],
    );

    // Retrieve active guard id (in case conflict reused existing)
    const guardRow = get<SecurityGuard>("SELECT * FROM security_guards WHERE employee_id = ?", [employeeId]);
    const finalGuardId = guardRow?.id || guardId;

    // 2. Insert or update app_users sign-in account
    const existingUser = get<{ id: string }>("SELECT id FROM app_users WHERE lower(email) = lower(?)", [
      req.email.toLowerCase(),
    ]);
    const userId = existingUser?.id ?? nextId("USR", { pad: 4 });

    if (existingUser) {
      run(
        `UPDATE app_users
            SET password_hash = ?, password_salt = ?, name = ?, role = 'security',
                ref_id = ?, gate = ?, active = 1, updated_at = ?
          WHERE id = ?`,
        [req.password_hash, req.password_salt, req.full_name, finalGuardId, assignedGate, timestamp, userId],
      );
    } else {
      run(
        `INSERT INTO app_users
           (id, email, password_hash, password_salt, name, role, ref_id, gate, active, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          userId,
          req.email.toLowerCase(),
          req.password_hash,
          req.password_salt,
          req.full_name,
          "security",
          finalGuardId,
          assignedGate,
          1,
          timestamp,
          timestamp,
        ],
      );
    }

    // 3. Mark registration request as APPROVED
    run(
      `UPDATE guard_registration_requests
          SET status = 'APPROVED', reviewed_at = ?, reviewed_by = ?
        WHERE id = ?`,
      [timestamp, actor.userId, requestId],
    );

    audit(actor, {
      action: "guard.registration.approved",
      entity: "guard_registration",
      entityId: requestId,
      summary: `${actor.name} approved guard registration for ${req.full_name} (${employeeId}) at ${assignedGate}.`,
    });

    const savedGuard = findGuard(finalGuardId);
    if (!savedGuard) throw notFound("Guard record could not be verified after approval.");

    return { guard: savedGuard, accountId: userId };
  });

  // 4. Send approval notification email
  void sendGuardApprovalEmail({
    email: req.email,
    fullName: req.full_name,
    guardId: req.guard_id || result.guard.id,
    assignedGate,
    designation,
  });

  publish("guards", "approved", requestId);
  return result;
}

export function rejectGuardRegistration(
  requestId: string,
  actor: AuthSession,
  reason?: string,
): void {
  const req = get<GuardRegistrationRow>(
    "SELECT * FROM guard_registration_requests WHERE id = ?",
    [requestId],
  );
  if (!req) throw notFound("Guard registration request not found.");

  const timestamp = now();
  const cleanReason = reason?.trim() || null;

  tx(() => {
    run(
      `UPDATE guard_registration_requests
          SET status = 'REJECTED', rejection_reason = ?, reviewed_at = ?, reviewed_by = ?
        WHERE id = ?`,
      [cleanReason, timestamp, actor.userId, requestId],
    );

    audit(actor, {
      action: "guard.registration.rejected",
      entity: "guard_registration",
      entityId: requestId,
      summary: `${actor.name} rejected guard registration for ${req.full_name}.${cleanReason ? ` Reason: ${cleanReason}` : ""}`,
    });
  });

  void sendGuardRejectionEmail({
    email: req.email,
    fullName: req.full_name,
    reason: cleanReason ?? undefined,
  });

  publish("guards", "rejected", requestId);
}

export function suspendGuardAccount(guardId: string, actor: AuthSession, reason?: string): void {
  const guard = findGuard(guardId);
  if (!guard) throw notFound("Guard not found.");

  tx(() => {
    run("UPDATE security_guards SET status = 'Suspended', updated_at = ? WHERE id = ?", [now(), guardId]);
    const account = get<{ id: string }>("SELECT id FROM app_users WHERE ref_id = ?", [guardId]);
    if (account) {
      run("UPDATE app_users SET active = 0, updated_at = ? WHERE id = ?", [now(), account.id]);
      revokeSessionsFor(account.id);
    }
    if (guard.email) {
      run(
        "UPDATE guard_registration_requests SET status = 'SUSPENDED', rejection_reason = ?, reviewed_at = ?, reviewed_by = ? WHERE lower(email) = lower(?)",
        [reason ?? "Account suspended by administrator", now(), actor.userId, guard.email],
      );
    }
    audit(actor, {
      action: "guard.suspended",
      entity: "guard",
      entityId: guardId,
      summary: `${actor.name} suspended guard ${guard.fullName}.${reason ? ` Reason: ${reason}` : ""}`,
    });
  });

  publish("guards", "suspended", guardId);
}

export function reactivateGuardAccount(guardId: string, actor: AuthSession): void {
  const guard = findGuard(guardId);
  if (!guard) throw notFound("Guard not found.");

  tx(() => {
    run("UPDATE security_guards SET status = 'Active', updated_at = ? WHERE id = ?", [now(), guardId]);
    const account = get<{ id: string }>("SELECT id FROM app_users WHERE ref_id = ?", [guardId]);
    if (account) {
      run("UPDATE app_users SET active = 1, updated_at = ? WHERE id = ?", [now(), account.id]);
    }
    if (guard.email) {
      run(
        "UPDATE guard_registration_requests SET status = 'APPROVED', rejection_reason = NULL, reviewed_at = ?, reviewed_by = ? WHERE lower(email) = lower(?)",
        [now(), actor.userId, guard.email],
      );
    }
    audit(actor, {
      action: "guard.reactivated",
      entity: "guard",
      entityId: guardId,
      summary: `${actor.name} reactivated guard ${guard.fullName}.`,
    });
  });

  publish("guards", "reactivated", guardId);
}
