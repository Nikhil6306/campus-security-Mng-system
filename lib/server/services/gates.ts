import "server-only";

import type { AuthSession, CampusLocation, CheckLog, SecurityGuard } from "@/lib/types";
import { all, get, nextId, run, toInt, tx } from "../db";
import { audit } from "../audit";
import { publish } from "../events";
import { conflict, notFound } from "../errors";
import { listGuards, mapCheckLog, mapLocation } from "../repo";
import type { gateSchema } from "../validation";
import type { z } from "zod";

/**
 * Campus gates.
 *
 * A gate is a row in `campus_locations` with `kind = 'Gate'`. Nothing about a
 * gate's traffic is stored on the gate itself — entries, exits and the number
 * of visitors still inside are all derived from `check_logs` at read time, so
 * the figures can never drift away from the log they are meant to summarise.
 */

type GateInput = z.infer<typeof gateSchema>;

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

export interface GateActivity {
  gate: string;
  entriesToday: number;
  exitsToday: number;
  /** Visitors who entered through this gate and have not been checked out. */
  currentlyInside: number;
  vehiclesInside: number;
  openIncidents: number;
  lastActivityAt?: string;
}

export interface GateRosterRow {
  location: CampusLocation;
  guards: SecurityGuard[];
  activity: GateActivity;
}

export interface GateDetail extends GateRosterRow {
  recentLogs: CheckLog[];
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export function listGates(): CampusLocation[] {
  return all("SELECT * FROM campus_locations WHERE kind = 'Gate' ORDER BY name").map(mapLocation);
}

function findGate(id: string): CampusLocation | undefined {
  const row = get("SELECT * FROM campus_locations WHERE id = ? AND kind = 'Gate'", [id]);
  return row ? mapLocation(row) : undefined;
}

/** Traffic for one gate, computed from the logs rather than a stored counter. */
export function gateActivity(gate: string): GateActivity {
  const day = today();

  const entries = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM check_logs WHERE gate = ? AND direction = 'In' AND substr(at, 1, 10) = ?",
    [gate, day],
  );
  const exits = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM check_logs WHERE gate = ? AND direction = 'Out' AND substr(at, 1, 10) = ?",
    [gate, day],
  );

  // Inside via this gate: an 'In' log stamped here with no matching 'Out' log.
  // Derived from the logs rather than the booking's own `gate` column, because a
  // visitor may leave through a different gate than the one they entered by.
  const inside = get<{ c: number }>(
    `SELECT COUNT(*) AS c
       FROM check_logs inLog
      WHERE inLog.gate = ?
        AND inLog.direction = 'In'
        AND NOT EXISTS (
          SELECT 1 FROM check_logs outLog
           WHERE outLog.visit_request_id = inLog.visit_request_id
             AND outLog.direction = 'Out'
        )`,
    [gate],
  );

  const vehicles = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM vehicles WHERE gate = ? AND status = 'Inside'",
    [gate],
  );

  const incidents = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM incidents WHERE location = ? AND status IN ('Open','Investigating')",
    [gate],
  );

  const last = get<{ at: string }>(
    "SELECT at FROM check_logs WHERE gate = ? ORDER BY at DESC LIMIT 1",
    [gate],
  );

  return {
    gate,
    entriesToday: entries?.c ?? 0,
    exitsToday: exits?.c ?? 0,
    currentlyInside: inside?.c ?? 0,
    vehiclesInside: vehicles?.c ?? 0,
    openIncidents: incidents?.c ?? 0,
    lastActivityAt: last?.at,
  };
}

export function gateRoster(): GateRosterRow[] {
  const guards = listGuards();
  return listGates().map((location) => ({
    location,
    guards: guards.filter((guard) => guard.assignedGate === location.name),
    activity: gateActivity(location.name),
  }));
}

export function gateDetail(id: string): GateDetail {
  const location = findGate(id);
  if (!location) throw notFound("That gate no longer exists.");

  const guards = listGuards().filter((guard) => guard.assignedGate === location.name);
  const recentLogs = all("SELECT * FROM check_logs WHERE gate = ? ORDER BY at DESC LIMIT 50", [
    location.name,
  ]).map(mapCheckLog);

  return { location, guards, activity: gateActivity(location.name), recentLogs };
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export function createGate(input: GateInput, actor: AuthSession): CampusLocation {
  const clash = get("SELECT id FROM campus_locations WHERE lower(name) = lower(?)", [input.name]);
  if (clash) throw conflict(`A campus location named "${input.name}" already exists.`);

  const created = tx(() => {
    const id = nextId("GATE", { pad: 3 });
    run("INSERT INTO campus_locations(id, name, kind, active) VALUES (?,?,?,?)", [
      id,
      input.name,
      "Gate",
      toInt(input.active),
    ]);
    audit(actor, {
      action: "gate.created",
      entity: "gate",
      entityId: id,
      summary: `${actor.name} added the ${input.name} gate.`,
    });
    const row = findGate(id);
    if (!row) throw notFound("The gate could not be saved.");
    return row;
  });

  publish("gates", "created", created.id);
  return created;
}

export function updateGate(id: string, input: GateInput, actor: AuthSession): CampusLocation {
  const current = findGate(id);
  if (!current) throw notFound("That gate no longer exists.");

  const clash = get("SELECT id FROM campus_locations WHERE lower(name) = lower(?) AND id <> ?", [
    input.name,
    id,
  ]);
  if (clash) throw conflict(`A campus location named "${input.name}" already exists.`);

  // Closing a gate that guards are still posted to would leave them unreachable.
  if (!input.active && current.active) {
    const posted = listGuards().filter(
      (guard) => guard.assignedGate === current.name && guard.status !== "Off Duty",
    );
    if (posted.length) {
      throw conflict(
        `${posted.length} guard(s) are still posted to ${current.name}. Reassign them before closing it.`,
      );
    }
  }

  const updated = tx(() => {
    run("UPDATE campus_locations SET name = ?, active = ? WHERE id = ?", [
      input.name,
      toInt(input.active),
      id,
    ]);
    // Guard postings and logs reference a gate by name, so a rename has to
    // carry through or their history would point at a gate that no longer exists.
    if (input.name !== current.name) {
      run("UPDATE security_guards SET assigned_gate = ?, updated_at = ? WHERE assigned_gate = ?", [
        input.name,
        now(),
        current.name,
      ]);
      run("UPDATE app_users SET gate = ? WHERE gate = ?", [input.name, current.name]);
    }
    audit(actor, {
      action: "gate.updated",
      entity: "gate",
      entityId: id,
      summary:
        input.name !== current.name
          ? `${actor.name} renamed the ${current.name} gate to ${input.name}.`
          : `${actor.name} ${input.active ? "opened" : "closed"} the ${input.name} gate.`,
    });
    const row = findGate(id);
    if (!row) throw notFound("That gate no longer exists.");
    return row;
  });

  publish("gates", "updated", id);
  return updated;
}

export function deleteGate(id: string, actor: AuthSession): void {
  const current = findGate(id);
  if (!current) throw notFound("That gate no longer exists.");

  const posted = listGuards().filter((guard) => guard.assignedGate === current.name);
  if (posted.length) {
    throw conflict(
      `${posted.length} guard(s) are posted to ${current.name}. Reassign them before deleting it.`,
    );
  }

  const logged = get<{ c: number }>("SELECT COUNT(*) AS c FROM check_logs WHERE gate = ?", [
    current.name,
  ]);
  if ((logged?.c ?? 0) > 0) {
    throw conflict(
      `${current.name} has ${logged?.c} gate movement(s) on record. Close it instead of deleting it so the audit trail stays intact.`,
    );
  }

  tx(() => {
    run("DELETE FROM campus_locations WHERE id = ?", [id]);
    audit(actor, {
      action: "gate.deleted",
      entity: "gate",
      entityId: id,
      summary: `${actor.name} deleted the ${current.name} gate.`,
    });
  });

  publish("gates", "deleted", id);
}

/** Posts a guard to a gate. Also moves the guard's sign-in account with them. */
export function assignGuardToGate(
  guardId: string,
  gateName: string,
  actor: AuthSession,
): SecurityGuard {
  const gate = get("SELECT * FROM campus_locations WHERE name = ? AND kind = 'Gate'", [gateName]);
  if (!gate) throw notFound("That gate no longer exists.");
  const location = mapLocation(gate);
  if (!location.active) throw conflict(`${location.name} is closed. Open it before posting guards.`);

  const guard = listGuards().find((g) => g.id === guardId);
  if (!guard) throw notFound("That guard is no longer on the roster.");

  const updated = tx(() => {
    run("UPDATE security_guards SET assigned_gate = ?, updated_at = ? WHERE id = ?", [
      location.name,
      now(),
      guardId,
    ]);
    run("UPDATE app_users SET gate = ? WHERE ref_id = ? AND role = 'security'", [
      location.name,
      guardId,
    ]);
    audit(actor, {
      action: "gate.guard_assigned",
      entity: "gate",
      entityId: location.id,
      summary: `${actor.name} posted ${guard.fullName} to ${location.name}.`,
    });
    const row = listGuards().find((g) => g.id === guardId);
    if (!row) throw notFound("That guard is no longer on the roster.");
    return row;
  });

  publish("guards", "assigned", guardId);
  return updated;
}
