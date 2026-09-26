import "server-only";

import type { AuthSession, GuardActivitySummary, SecurityGuard } from "@/lib/types";
import { all, get, nextId, run, tx } from "../db";
import { audit } from "../audit";
import { publish } from "../events";
import { conflict, notFound } from "../errors";
import { findGuard, guardActivity, listGuards, mapCheckLog, mapIncident } from "../repo";
import type { CheckLog, Incident } from "@/lib/types";
import { revokeSessionsFor } from "../auth";
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
