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
import { persistSecondaryToSupabase, persistToSupabase } from "../supabase-db";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { sendGuardApprovalEmail, sendGuardRegistrationSubmittedEmail, sendGuardRejectionEmail } from "./email";
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
  persistSecondaryToSupabase("security_guards", toSupabaseGuardPayload(created), "upsert", "id");
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
  persistSecondaryToSupabase("security_guards", toSupabaseGuardPayload(updated), "upsert", "id");
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
  persistSecondaryToSupabase("security_guards", { id }, "delete", "id");
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
  guardId?: string;
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
  const rawDigits = input.phone.replace(/\D/g, "");
  const normalizedPhone = rawDigits.length === 12 && rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits;
  const cleanPhone = normalizedPhone.length === 10 ? normalizedPhone : input.phone.trim();
  const cleanName = input.fullName.trim();
  const cleanGuardId = (input.guardId?.trim() || nextId("GRD", { pad: 3 })).toUpperCase();

  if (!cleanName || cleanName.length < 3) throw badRequest("Full name must be at least 3 characters.");
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw badRequest("A valid email address is required.");
  }
  if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
    throw badRequest("A valid 10-digit Indian mobile number is required (+91 optional).");
  }
  if (!input.password || input.password.length < 6) {
    throw badRequest("Password must be at least 6 characters.");
  }

  // Check if an account already exists in app_users
  const existingUser = get<{ id: string }>("SELECT id FROM app_users WHERE lower(email) = lower(?)", [cleanEmail]);
  if (existingUser) {
    throw conflict("An account with this email address already exists. Please log in.");
  }

  // Check existing in guard_registration_requests by email
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

  // Check duplicate mobile number in guard_registration_requests
  const existingPhoneReq = get<GuardRegistrationRow>(
    "SELECT * FROM guard_registration_requests WHERE phone = ? OR phone = ? OR phone = ?",
    [normalizedPhone, `+91${normalizedPhone}`, input.phone.trim()],
  );
  if (existingPhoneReq && existingPhoneReq.id !== existingReq?.id) {
    if (existingPhoneReq.status === "PENDING") {
      throw conflict("A guard registration request with this mobile number is already pending administrator approval.");
    }
    if (existingPhoneReq.status === "APPROVED") {
      throw conflict("A guard account with this mobile number already exists. Please log in.");
    }
    throw conflict("A registration with this mobile number already exists.");
  }

  // Check duplicate mobile number in security_guards roster
  const existingGuardPhone = get<{ id: string }>(
    "SELECT id FROM security_guards WHERE phone = ? OR phone = ? OR phone = ?",
    [normalizedPhone, `+91${normalizedPhone}`, input.phone.trim()],
  );
  if (existingGuardPhone) {
    throw conflict("A registered security guard with this mobile number already exists.");
  }

  const { hash, salt } = hashPassword(input.password);
  const idPre = existingReq?.id ?? nextId("REQ-GRD", { pad: 4 });
  const timestamp = now();
  const designation = input.designation?.trim() || "Security Guard";
  const assignedGate = input.assignedGate?.trim() || "Main Gate";

  // All duplicate checks and the INSERT run inside a single exclusive transaction
  // so that concurrent requests cannot race past the email/phone guards.
  let id = idPre;
  tx(() => {
    // Re-check inside transaction for race-condition safety
    const concurrentUser = get<{ id: string }>("SELECT id FROM app_users WHERE lower(email) = lower(?)", [cleanEmail]);
    if (concurrentUser) throw conflict("An account with this email address already exists. Please log in.");

    const concurrentReq = get<GuardRegistrationRow>(
      "SELECT * FROM guard_registration_requests WHERE lower(email) = lower(?)",
      [cleanEmail],
    );
    if (concurrentReq && concurrentReq.status === "PENDING") {
      throw conflict("Your guard registration is already pending administrator approval.");
    }
    if (concurrentReq && concurrentReq.status === "APPROVED") {
      throw conflict("Your guard account has already been approved. Please log in.");
    }
    // Use existing id if re-submitting after REJECTED
    if (concurrentReq) id = concurrentReq.id;

    const concurrentPhone = get<GuardRegistrationRow>(
      "SELECT * FROM guard_registration_requests WHERE (phone = ? OR phone = ? OR phone = ?) AND id != ?",
      [normalizedPhone, `+91${normalizedPhone}`, input.phone.trim(), id],
    );
    if (concurrentPhone) {
      if (concurrentPhone.status === "PENDING") throw conflict("A guard registration request with this mobile number is already pending administrator approval.");
      if (concurrentPhone.status === "APPROVED") throw conflict("A guard account with this mobile number already exists. Please log in.");
      throw conflict("A registration with this mobile number already exists.");
    }

    const concurrentGuardPhone = get<{ id: string }>(
      "SELECT id FROM security_guards WHERE phone = ? OR phone = ? OR phone = ?",
      [normalizedPhone, `+91${normalizedPhone}`, input.phone.trim()],
    );
    if (concurrentGuardPhone) throw conflict("A registered security guard with this mobile number already exists.");

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

  void sendGuardRegistrationSubmittedEmail({
    email: cleanEmail,
    fullName: cleanName,
    requestId: id,
  });

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

/* ------------------------------------------------------------------ *
 * Supabase Persistence Helpers for Guard Registration & Approval
 * ------------------------------------------------------------------ */

function toSupabaseGuardPayload(g: SecurityGuard): Record<string, unknown> {
  return {
    id: g.id,
    employee_id: g.employeeId,
    full_name: g.fullName,
    phone: g.phone,
    email: g.email,
    photo_url: g.photoUrl ?? null,
    shift: g.shift,
    shift_start: g.shiftStart,
    shift_end: g.shiftEnd,
    assigned_gate: g.assignedGate,
    status: g.status,
    joining_date: g.joiningDate,
    emergency_contact: g.emergencyContact,
    address: g.address,
    created_at: g.createdAt,
    updated_at: g.updatedAt,
  };
}

async function hydrateGuardRequestFromSupabase(requestId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const local = get<GuardRegistrationRow>("SELECT * FROM guard_registration_requests WHERE id = ?", [requestId]);
  if (local) return;

  const admin = getSupabaseAdminClient();
  const { data: r } = await admin
    .from("guard_registration_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!r) return;

  run(
    `INSERT INTO guard_registration_requests
       (id, full_name, email, phone, guard_id, designation, assigned_gate,
        password_hash, password_salt, status, rejection_reason, created_at, reviewed_at, reviewed_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       rejection_reason = excluded.rejection_reason,
       reviewed_at = excluded.reviewed_at,
       reviewed_by = excluded.reviewed_by`,
    [
      r.id,
      r.full_name,
      String(r.email || "").toLowerCase(),
      r.phone || "",
      r.guard_id || "",
      r.designation || "Security Guard",
      r.assigned_gate || "Main Gate",
      r.password_hash || "",
      r.password_salt || "",
      r.status || "PENDING",
      r.rejection_reason || null,
      r.created_at || now(),
      r.reviewed_at || null,
      r.reviewed_by || null,
    ],
  );
}

/**
 * Registers a new guard request in both local SQLite and Supabase (single source of truth),
 * and provisions a disabled Supabase Auth user (`profiles.active = false`) so the guard's
 * chosen password is stored securely in Supabase Auth and cannot be used until Admin approves.
 */
export async function createGuardRegistrationRequestAsync(
  input: GuardRegistrationInput,
): Promise<GuardRegistrationRow> {
  const cleanEmail = input.email.trim().toLowerCase();
  const rawDigits = input.phone.replace(/\D/g, "");
  const normalizedPhone = rawDigits.length === 12 && rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits;

  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();

    // 1. Check existing profile in Supabase
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, role, active")
      .ilike("email", cleanEmail)
      .maybeSingle();

    // Allow re-submission only if there's a REJECTED guard request for this email
    const { data: existingSbReq } = await admin
      .from("guard_registration_requests")
      .select("id, status, email, phone")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (existingSbReq) {
      if (existingSbReq.status === "PENDING") {
        throw conflict("Your guard registration is already pending administrator approval.");
      }
      if (existingSbReq.status === "APPROVED") {
        throw conflict("Your guard account has already been approved. Please log in.");
      }
    } else if (existingProfile) {
      throw conflict("An account with this email address already exists. Please log in.");
    }

    // 2. Check duplicate mobile in Supabase guard_registration_requests
    if (/^[6-9]\d{9}$/.test(normalizedPhone)) {
      const { data: phoneReqs } = await admin
        .from("guard_registration_requests")
        .select("id, status")
        .or(`phone.eq.${normalizedPhone},phone.eq.+91${normalizedPhone}`);
      const conflictingPhone = (phoneReqs || []).find((r) => r.id !== existingSbReq?.id);
      if (conflictingPhone) {
        if (conflictingPhone.status === "PENDING") {
          throw conflict("A guard registration request with this mobile number is already pending administrator approval.");
        }
        if (conflictingPhone.status === "APPROVED") {
          throw conflict("A guard account with this mobile number already exists. Please log in.");
        }
        throw conflict("A registration with this mobile number already exists.");
      }

      const { data: guardPhones } = await admin
        .from("security_guards")
        .select("id")
        .or(`phone.eq.${normalizedPhone},phone.eq.+91${normalizedPhone}`)
        .limit(1);
      if (guardPhones && guardPhones.length > 0) {
        throw conflict("A registered security guard with this mobile number already exists.");
      }
    }
  }

  // Create local SQLite record & hash password
  const created = createGuardRegistrationRequest(input);

  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();

    // Persist registration request to Supabase
    await persistToSupabase(
      "guard_registration_requests",
      {
        id: created.id,
        full_name: created.full_name,
        email: created.email,
        phone: created.phone,
        guard_id: created.guard_id,
        designation: created.designation,
        assigned_gate: created.assigned_gate,
        password_hash: created.password_hash,
        password_salt: created.password_salt,
        status: created.status,
        rejection_reason: created.rejection_reason,
        created_at: created.created_at,
        reviewed_at: created.reviewed_at,
        reviewed_by: created.reviewed_by,
      },
      "upsert",
      "email",
    );

    // Provision a locked Supabase Auth account (active = false in profiles)
    // so the guard's chosen password is stored in Supabase Auth without plaintext storage.
    try {
      const { data: createdAuth, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: created.full_name,
          role: "visitor",
          pending_guard: true,
        },
      });

      if (!createErr && createdAuth?.user) {
        await admin.from("profiles").upsert({
          id: createdAuth.user.id,
          email: cleanEmail,
          full_name: created.full_name,
          role: "visitor",
          active: false,
          updated_at: now(),
        });
      } else if (createErr && /already/i.test(createErr.message)) {
        // Re-submission for previously rejected user: update password & keep active = false
        const { data: prof } = await admin.from("profiles").select("id").ilike("email", cleanEmail).maybeSingle();
        if (prof?.id) {
          await admin.auth.admin.updateUserById(prof.id, { password: input.password });
          await admin.from("profiles").update({ active: false, full_name: created.full_name, updated_at: now() }).eq("id", prof.id);
        }
      }
    } catch (authSyncErr) {
      console.warn("[guards] Supabase Auth pre-provisioning warning:", authSyncErr);
    }
  }

  return created;
}

/**
 * Approves a guard registration atomically across SQLite, Supabase tables,
 * and Supabase Auth `public.profiles` (activating role = 'security').
 */
export async function approveGuardRegistrationAsync(
  requestId: string,
  actor: AuthSession,
  options?: ApproveGuardOptions,
): Promise<{ guard: SecurityGuard; accountId: string }> {
  await hydrateGuardRequestFromSupabase(requestId);
  const result = approveGuardRegistration(requestId, actor, options);

  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    const req = get<GuardRegistrationRow>("SELECT * FROM guard_registration_requests WHERE id = ?", [requestId]);

    await persistToSupabase("security_guards", toSupabaseGuardPayload(result.guard), "upsert", "id");

    if (req) {
      await persistToSupabase(
        "guard_registration_requests",
        {
          id: req.id,
          status: "APPROVED",
          reviewed_at: req.reviewed_at,
          reviewed_by: req.reviewed_by,
        },
        "update",
        "id",
      );

      // Activate Supabase Auth profile with 'security' role
      const { data: prof } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", req.email)
        .maybeSingle();

      if (prof?.id) {
        await admin
          .from("profiles")
          .update({
            role: "security",
            ref_id: result.guard.id,
            gate: result.guard.assignedGate,
            full_name: result.guard.fullName,
            active: true,
            updated_at: now(),
          })
          .eq("id", prof.id);
      } else {
        // Fallback: look up user in auth.users or create if missing
        const { data: listData } = await admin.auth.admin.listUsers();
        const authUser = listData?.users?.find((u) => u.email?.toLowerCase() === req.email.toLowerCase());
        if (authUser) {
          await admin.from("profiles").upsert({
            id: authUser.id,
            email: req.email.toLowerCase(),
            full_name: result.guard.fullName,
            role: "security",
            ref_id: result.guard.id,
            gate: result.guard.assignedGate,
            active: true,
            updated_at: now(),
          });
        }
      }
    }
  }

  return result;
}

export async function rejectGuardRegistrationAsync(
  requestId: string,
  actor: AuthSession,
  reason?: string,
): Promise<void> {
  await hydrateGuardRequestFromSupabase(requestId);
  rejectGuardRegistration(requestId, actor, reason);

  if (isSupabaseConfigured()) {
    const req = get<GuardRegistrationRow>("SELECT * FROM guard_registration_requests WHERE id = ?", [requestId]);
    if (req) {
      await persistToSupabase(
        "guard_registration_requests",
        {
          id: req.id,
          status: "REJECTED",
          rejection_reason: req.rejection_reason,
          reviewed_at: req.reviewed_at,
          reviewed_by: req.reviewed_by,
        },
        "update",
        "id",
      );
      const admin = getSupabaseAdminClient();
      await admin.from("profiles").update({ active: false, updated_at: now() }).ilike("email", req.email);
    }
  }
}

export async function suspendGuardAccountAsync(
  guardId: string,
  actor: AuthSession,
  reason?: string,
): Promise<void> {
  suspendGuardAccount(guardId, actor, reason);
  if (isSupabaseConfigured()) {
    const guard = findGuard(guardId);
    const admin = getSupabaseAdminClient();
    await persistToSupabase("security_guards", { id: guardId, status: "Suspended", updated_at: now() }, "update", "id");
    if (guard?.email) {
      await admin
        .from("guard_registration_requests")
        .update({
          status: "SUSPENDED",
          rejection_reason: reason ?? "Account suspended by administrator",
          reviewed_at: now(),
          reviewed_by: actor.userId,
        })
        .ilike("email", guard.email);
      await admin.from("profiles").update({ active: false, updated_at: now() }).ilike("email", guard.email);
    }
  }
}

export async function reactivateGuardAccountAsync(
  guardId: string,
  actor: AuthSession,
): Promise<void> {
  reactivateGuardAccount(guardId, actor);
  if (isSupabaseConfigured()) {
    const guard = findGuard(guardId);
    const admin = getSupabaseAdminClient();
    await persistToSupabase("security_guards", { id: guardId, status: "Active", updated_at: now() }, "update", "id");
    if (guard?.email) {
      await admin
        .from("guard_registration_requests")
        .update({
          status: "APPROVED",
          rejection_reason: null,
          reviewed_at: now(),
          reviewed_by: actor.userId,
        })
        .ilike("email", guard.email);
      await admin.from("profiles").update({ active: true, role: "security", updated_at: now() }).ilike("email", guard.email);
    }
  }
}
