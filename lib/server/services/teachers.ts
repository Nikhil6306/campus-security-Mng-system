import "server-only";

import type { AuthSession, Teacher, TeacherAvailability } from "@/lib/types";
import { get, nextId, run, toInt, tx } from "../db";
import { audit } from "../audit";
import { publish } from "../events";
import { conflict, notFound } from "../errors";
import { findAvailability, findTeacher } from "../repo";
import type { availabilitySchema, teacherSchema } from "../validation";
import type { z } from "zod";

type TeacherInput = z.infer<typeof teacherSchema>;
type AvailabilityInput = z.infer<typeof availabilitySchema>;

const now = () => new Date().toISOString();

export function createTeacher(input: TeacherInput, actor: AuthSession): Teacher {
  const department = get<{ id: string }>("SELECT id FROM departments WHERE id = ?", [
    input.departmentId,
  ]);
  if (!department) throw notFound("That department does not exist.");

  const created = tx(() => {
    const id = nextId("TCH", { pad: 3 });
    const timestamp = now();
    run(
      `INSERT INTO teachers
         (id, employee_id, name, email, phone, whatsapp_number, department_id, designation,
          photo_url, room, availability_status, active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        input.employeeId.toUpperCase(),
        input.name,
        input.email,
        input.phone,
        input.whatsappNumber || input.phone,
        input.departmentId,
        input.designation,
        input.photoUrl ?? null,
        input.room,
        input.availabilityStatus,
        toInt(input.active),
        timestamp,
        timestamp,
      ],
    );
    // Every host gets a default working pattern so they are bookable at once.
    run(
      "INSERT INTO teacher_availability(teacher_id, days, start_time, end_time, slot_minutes, blocked, updated_at) VALUES (?,?,?,?,?,?,?)",
      [id, "[1,2,3,4,5]", "09:00", "17:00", 30, "[]", timestamp],
    );
    audit(actor, {
      action: "teacher.created",
      entity: "teacher",
      entityId: id,
      summary: `${actor.name} added ${input.name} (${input.designation}) to the staff directory.`,
    });
    const row = findTeacher(id);
    if (!row) throw notFound("The staff record could not be saved.");
    return row;
  });

  publish("teachers", "created", created.id);
  return created;
}

export function updateTeacher(id: string, input: TeacherInput, actor: AuthSession): Teacher {
  const current = findTeacher(id);
  if (!current) throw notFound("That staff member is no longer listed.");

  const updated = tx(() => {
    run(
      `UPDATE teachers
          SET employee_id = ?, name = ?, email = ?, phone = ?, whatsapp_number = ?,
              department_id = ?, designation = ?,
              photo_url = ?, room = ?, availability_status = ?, active = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.employeeId.toUpperCase(),
        input.name,
        input.email,
        input.phone,
        input.whatsappNumber || input.phone,
        input.departmentId,
        input.designation,
        input.photoUrl ?? null,
        input.room,
        input.availabilityStatus,
        toInt(input.active),
        now(),
        id,
      ],
    );
    audit(actor, {
      action: "teacher.updated",
      entity: "teacher",
      entityId: id,
      summary: `${actor.name} updated the record for ${input.name}.`,
    });
    const row = findTeacher(id);
    if (!row) throw notFound("That staff member is no longer listed.");
    return row;
  });

  publish("teachers", "updated", id);
  return updated;
}

export function deleteTeacher(id: string, actor: AuthSession): void {
  const current = findTeacher(id);
  if (!current) throw notFound("That staff member is no longer listed.");

  const open = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM visit_requests
      WHERE host_id = ? AND status IN ('Pending','Approved','Rescheduled','Checked In','Meeting In Progress')`,
    [id],
  );
  if ((open?.c ?? 0) > 0) {
    throw conflict(
      `${current.name} still has ${open?.c} open booking(s). Close or reassign them first.`,
    );
  }

  tx(() => {
    run("DELETE FROM teachers WHERE id = ?", [id]);
    audit(actor, {
      action: "teacher.deleted",
      entity: "teacher",
      entityId: id,
      summary: `${actor.name} removed ${current.name} from the staff directory.`,
    });
  });

  publish("teachers", "deleted", id);
}

/**
 * Replaces a host's working pattern.
 *
 * Existing bookings are never silently dropped: if the new pattern would strand
 * confirmed visits, the caller is told which ones so a human can reschedule.
 */
export function setAvailability(
  teacherId: string,
  input: AvailabilityInput,
  actor: AuthSession,
): TeacherAvailability {
  const teacher = findTeacher(teacherId);
  if (!teacher) throw notFound("That staff member is no longer listed.");
  if (input.startTime >= input.endTime) {
    throw conflict("The end of the working day must be after its start.");
  }

  const updated = tx(() => {
    const timestamp = now();
    run(
      `INSERT INTO teacher_availability(teacher_id, days, start_time, end_time, slot_minutes, blocked, updated_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(teacher_id) DO UPDATE SET
         days = excluded.days, start_time = excluded.start_time, end_time = excluded.end_time,
         slot_minutes = excluded.slot_minutes, blocked = excluded.blocked, updated_at = excluded.updated_at`,
      [
        teacherId,
        JSON.stringify(input.days),
        input.startTime,
        input.endTime,
        input.slotMinutes,
        JSON.stringify(input.blocked),
        timestamp,
      ],
    );
    audit(actor, {
      action: "availability.updated",
      entity: "teacher",
      entityId: teacherId,
      summary: `${actor.name} updated the availability for ${teacher.name}.`,
    });
    return findAvailability(teacherId);
  });

  publish("teachers", "availability", teacherId);
  return updated;
}

/** Bookings that fall outside a host's current pattern — surfaced as a warning. */
export function strandedBookings(teacherId: string): string[] {
  const availability = findAvailability(teacherId);
  const rows = get<{ ids: string | null }>(
    `SELECT group_concat(id) AS ids FROM visit_requests
      WHERE host_id = ? AND status IN ('Pending','Approved','Rescheduled')`,
    [teacherId],
  );
  if (!rows?.ids) return [];

  const ids = rows.ids.split(",");
  return ids.filter((id) => {
    const row = get<{ visit_date: string; visit_time: string }>(
      "SELECT visit_date, visit_time FROM visit_requests WHERE id = ?",
      [id],
    );
    if (!row) return false;
    const day = new Date(`${row.visit_date}T00:00:00`).getDay();
    const isoDay = day === 0 ? 7 : day;
    if (!availability.days.includes(isoDay)) return true;
    if (availability.blocked.includes(row.visit_date)) return true;
    return row.visit_time < availability.startTime || row.visit_time >= availability.endTime;
  });
}
