import "server-only";

import type { AuthSession, EmergencyAlert, EmergencyStatus } from "@/lib/types";
import { nextId, run, tx } from "../db";
import { audit, notify } from "../audit";
import { publish } from "../events";
import { conflict, notFound } from "../errors";
import { findEmergency, findGuard } from "../repo";
import type { emergencySchema } from "../validation";
import type { z } from "zod";

/**
 * Campus emergency alerts.
 *
 * This raises an alert inside the campus security system and notifies the
 * dashboards that are signed in. It does not contact emergency services — no
 * call, message or dispatch leaves this application, by design. Real help is
 * summoned by a human on the phone; this record is what coordinates the campus
 * response around that call.
 */

const now = () => new Date().toISOString();

type EmergencyInput = z.infer<typeof emergencySchema>;

export function triggerEmergency(input: EmergencyInput, actor: AuthSession): EmergencyAlert {
  const guard = actor.refId ? findGuard(actor.refId) : undefined;
  const who = guard?.fullName ?? actor.name;

  const alert = tx(() => {
    const id = nextId("SOS");
    const timestamp = now();
    run(
      `INSERT INTO emergencies
         (id, type, severity, location, note, triggered_by, triggered_by_id, triggered_at, status)
       VALUES (?,?,?,?,?,?,?,?,'Active')`,
      [
        id,
        input.type,
        input.severity,
        input.location,
        input.note ?? null,
        who,
        guard?.id ?? null,
        timestamp,
      ],
    );

    notify({
      type: "emergency",
      title: `Emergency alert — ${input.type}`,
      message: `${input.severity} alert raised at ${input.location} by ${who}.`,
      href: "/admin/emergency",
    });

    audit(actor, {
      action: "emergency.triggered",
      entity: "emergency",
      entityId: id,
      summary: `${who} raised a ${input.type} alert at ${input.location}.`,
    });

    const created = findEmergency(id);
    if (!created) throw notFound("The alert could not be raised.");
    return created;
  });

  publish("emergency", "triggered", alert.id);
  return alert;
}

export function updateEmergencyStatus(
  id: string,
  status: EmergencyStatus,
  actor: AuthSession,
): EmergencyAlert {
  const current = findEmergency(id);
  if (!current) throw notFound("That alert no longer exists.");
  if (current.status === "Resolved") throw conflict("That alert is already resolved.");

  const updated = tx(() => {
    const timestamp = now();
    run(
      `UPDATE emergencies
          SET status = ?,
              acknowledged_at = CASE WHEN ? THEN COALESCE(acknowledged_at, ?) ELSE acknowledged_at END,
              acknowledged_by = CASE WHEN ? THEN COALESCE(acknowledged_by, ?) ELSE acknowledged_by END,
              resolved_at = CASE WHEN ? THEN ? ELSE resolved_at END
        WHERE id = ?`,
      [
        status,
        status === "Acknowledged" || status === "Resolved" ? 1 : 0,
        timestamp,
        status === "Acknowledged" || status === "Resolved" ? 1 : 0,
        actor.name,
        status === "Resolved" ? 1 : 0,
        timestamp,
        id,
      ],
    );

    audit(actor, {
      action: `emergency.${status.toLowerCase()}`,
      entity: "emergency",
      entityId: id,
      summary: `${actor.name} marked alert ${id} as ${status.toLowerCase()}.`,
    });

    const after = findEmergency(id);
    if (!after) throw notFound("That alert no longer exists.");
    return after;
  });

  publish("emergency", status.toLowerCase(), id);
  return updated;
}
