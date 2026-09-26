import "server-only";

import type { AuthSession, MovementLog, OutingRequest, OutingStatus } from "@/lib/types";
import { get, nextId, run, toInt, tx } from "../db";
import { audit, notify } from "../audit";
import { publish } from "../events";
import { badRequest, notFound } from "../errors";
import { mapMovement, mapOuting } from "../repo";
import type { movementSchema, outingSchema } from "../validation";
import type { z } from "zod";

/**
 * Student outings and campus movement.
 *
 * Hostel outings follow the same shape as visitor bookings — a request, a
 * decision, then a gate stamp — so the movement log is the single place the
 * dashboard reads presence from, for students and visitors alike.
 */

type OutingInput = z.infer<typeof outingSchema>;
type MovementInput = z.infer<typeof movementSchema>;

const now = () => new Date().toISOString();

function findOuting(id: string): OutingRequest | undefined {
  const row = get("SELECT * FROM outings WHERE id = ?", [id]);
  return row ? mapOuting(row) : undefined;
}

export function requestOuting(input: OutingInput, actor: AuthSession): OutingRequest {
  const student = get<{ id: string; name: string }>("SELECT id, name FROM students WHERE id = ?", [
    input.studentId,
  ]);
  if (!student) throw notFound("That student record does not exist.");
  if (input.toDate < input.fromDate) {
    throw badRequest("The return date cannot be before the departure date.", {
      toDate: "Choose a date on or after the start date.",
    });
  }

  const outing = tx(() => {
    const id = nextId("OUT");
    run(
      `INSERT INTO outings(id, student_id, student_name, type, reason, from_date, to_date,
                           guardian_approved, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,'Pending',?)`,
      [
        id,
        student.id,
        student.name,
        input.type,
        input.reason,
        input.fromDate,
        input.toDate,
        toInt(input.guardianApproved),
        now(),
      ],
    );
    notify({
      type: "request",
      title: "Student outing request",
      message: `${student.name} requested ${input.type.toLowerCase()} from ${input.fromDate}.`,
      href: "/admin/students",
    });
    audit(actor, {
      action: "outing.created",
      entity: "outing",
      entityId: id,
      summary: `${student.name} requested ${input.type} from ${input.fromDate} to ${input.toDate}.`,
    });
    const created = findOuting(id);
    if (!created) throw notFound("The request could not be saved.");
    return created;
  });

  publish("outings", "created", outing.id);
  return outing;
}

export function decideOuting(
  id: string,
  status: OutingStatus,
  actor: AuthSession,
): OutingRequest {
  const current = findOuting(id);
  if (!current) throw notFound("That outing request no longer exists.");

  const updated = tx(() => {
    run("UPDATE outings SET status = ?, decided_by = ? WHERE id = ?", [status, actor.name, id]);
    audit(actor, {
      action: `outing.${status.toLowerCase()}`,
      entity: "outing",
      entityId: id,
      summary: `${actor.name} marked ${current.studentName}'s ${current.type.toLowerCase()} as ${status.toLowerCase()}.`,
    });
    const after = findOuting(id);
    if (!after) throw notFound("That outing request no longer exists.");
    return after;
  });

  publish("outings", status.toLowerCase(), id);
  return updated;
}

export function logMovement(input: MovementInput, actor: AuthSession): MovementLog {
  const person =
    input.personType === "Student"
      ? get<{ id: string; name: string }>("SELECT id, name FROM students WHERE id = ?", [
          input.personId,
        ])
      : get<{ id: string; name: string }>("SELECT id, full_name AS name FROM visitors WHERE id = ?", [
          input.personId,
        ]);
  if (!person) throw notFound("That person is not on the campus register.");

  const movement = tx(() => {
    const id = nextId("MOV");
    const timestamp = now();
    run(
      "INSERT INTO movements(id, person_id, person_name, person_type, direction, gate, at) VALUES (?,?,?,?,?,?,?)",
      [id, person.id, person.name, input.personType, input.direction, input.gate, timestamp],
    );
    if (input.personType === "Student") {
      run("UPDATE students SET on_campus = ? WHERE id = ?", [
        input.direction === "Entry" ? 1 : 0,
        person.id,
      ]);
    }
    audit(actor, {
      action: "movement.logged",
      entity: "movement",
      entityId: id,
      summary: `${actor.name} logged ${person.name}'s ${input.direction.toLowerCase()} at ${input.gate}.`,
    });
    const row = get("SELECT * FROM movements WHERE id = ?", [id]);
    if (!row) throw notFound("The movement could not be saved.");
    return mapMovement(row);
  });

  publish("movements", "logged", movement.id);
  return movement;
}
