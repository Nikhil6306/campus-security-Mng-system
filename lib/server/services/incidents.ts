import "server-only";

import type { AuthSession, Incident } from "@/lib/types";
import { nextId, run, tx } from "../db";
import { audit, notify } from "../audit";
import { publish } from "../events";
import { conflict, notFound } from "../errors";
import { findGuard, findIncident, readSettings } from "../repo";
import { notificationService } from "../notification-service";
import type { incidentPatchSchema, incidentSchema } from "../validation";
import type { z } from "zod";

/**
 * Incident reporting and follow-up.
 *
 * Guards report; admins triage, assign and resolve. A guard can update the
 * incidents they raised but cannot close one — that decision stays with the
 * administrators, and the route layer enforces it.
 */

const now = () => new Date().toISOString();

type IncidentInput = z.infer<typeof incidentSchema>;
type IncidentPatch = z.infer<typeof incidentPatchSchema>;

export function reportIncident(input: IncidentInput, actor: AuthSession): Incident {
  const guard = actor.refId ? findGuard(actor.refId) : undefined;

  const incident = tx(() => {
    const id = nextId("INC");
    const timestamp = now();
    run(
      `INSERT INTO incidents
         (id, type, title, location, date, time, severity, description, reported_by,
          reported_by_id, attachment_url, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'Open',?,?)`,
      [
        id,
        input.type,
        input.title,
        input.location,
        input.date,
        input.time,
        input.severity,
        input.description,
        guard?.fullName ?? actor.name,
        guard?.id ?? null,
        input.attachmentUrl ?? null,
        timestamp,
        timestamp,
      ],
    );

    if (readSettings().notifyIncidents) {
      notify({
        type: "incident",
        title: `${input.severity} severity incident`,
        message: `${input.type} reported at ${input.location} by ${guard?.fullName ?? actor.name}.`,
        href: "/admin/incidents",
      });
    }

    audit(actor, {
      action: "incident.created",
      entity: "incident",
      entityId: id,
      summary: `${guard?.fullName ?? actor.name} reported ${input.type} (${input.severity}) at ${input.location}.`,
    });

    const created = findIncident(id);
    if (!created) throw notFound("The incident could not be saved.");
    return created;
  });

  publish("incidents", "created", incident.id);
  notificationService.sendIncidentAlert(incident, "security-control-room");
  return incident;
}

export function updateIncident(
  id: string,
  patch: IncidentPatch,
  actor: AuthSession,
): Incident {
  const current = findIncident(id);
  if (!current) throw notFound("That incident no longer exists.");
  if (current.status === "Closed" && patch.status !== undefined) {
    throw conflict("A closed incident cannot be reopened from here.");
  }

  const assignee =
    patch.assignedToId === undefined
      ? { id: current.assignedToId ?? null, name: current.assignedToName ?? null }
      : patch.assignedToId
        ? (() => {
            const guard = findGuard(patch.assignedToId!);
            if (!guard) throw notFound("That guard is not on the roster.");
            return { id: guard.id, name: guard.fullName };
          })()
        : { id: null, name: null };

  const status = patch.status ?? current.status;
  const resolving = status === "Resolved" || status === "Closed";

  if (resolving && !patch.resolutionNote && !current.resolutionNote) {
    throw conflict("Add a short resolution note before closing this incident.");
  }

  const updated = tx(() => {
    const timestamp = now();
    run(
      `UPDATE incidents
          SET status = ?, severity = ?, assigned_to_id = ?, assigned_to_name = ?,
              resolution_note = COALESCE(?, resolution_note),
              resolved_at = CASE WHEN ? THEN COALESCE(resolved_at, ?) ELSE NULL END,
              updated_at = ?
        WHERE id = ?`,
      [
        status,
        patch.severity ?? current.severity,
        assignee.id,
        assignee.name,
        patch.resolutionNote ?? null,
        resolving ? 1 : 0,
        timestamp,
        timestamp,
        id,
      ],
    );

    const changes: string[] = [];
    if (patch.status && patch.status !== current.status) changes.push(`status → ${patch.status}`);
    if (patch.severity && patch.severity !== current.severity)
      changes.push(`severity → ${patch.severity}`);
    if (patch.assignedToId !== undefined)
      changes.push(assignee.name ? `assigned to ${assignee.name}` : "unassigned");

    audit(actor, {
      action: resolving ? "incident.resolved" : "incident.updated",
      entity: "incident",
      entityId: id,
      summary: `${actor.name} updated ${id}${changes.length ? ` — ${changes.join(", ")}` : ""}.`,
    });

    if (patch.assignedToId && assignee.name) {
      notify({
        type: "incident",
        title: "Incident assigned",
        message: `${id} (${current.type}) assigned to ${assignee.name}.`,
        href: "/admin/incidents",
        audience: "security",
      });
    }

    const after = findIncident(id);
    if (!after) throw notFound("That incident no longer exists.");
    return after;
  });

  publish("incidents", resolving ? "resolved" : "updated", id);
  return updated;
}
