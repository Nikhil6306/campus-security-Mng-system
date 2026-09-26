import "server-only";

import type { AuthSession, Department } from "@/lib/types";
import { get, nextId, run, toInt, tx } from "../db";
import { audit } from "../audit";
import { publish } from "../events";
import { conflict, notFound } from "../errors";
import { listDepartments, mapDepartment } from "../repo";
import type { departmentSchema } from "../validation";
import type { z } from "zod";

type DepartmentInput = z.infer<typeof departmentSchema>;

const now = () => new Date().toISOString();

function find(id: string): Department | undefined {
  const row = get("SELECT * FROM departments WHERE id = ?", [id]);
  return row ? mapDepartment(row) : undefined;
}

export function createDepartment(input: DepartmentInput, actor: AuthSession): Department {
  const created = tx(() => {
    const id = nextId("DEPT", { pad: 3 });
    const timestamp = now();
    run(
      `INSERT INTO departments(id, name, code, head, location, phone, email, active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        input.name,
        input.code.toUpperCase(),
        input.head,
        input.location,
        input.phone,
        input.email,
        toInt(input.active),
        timestamp,
        timestamp,
      ],
    );
    audit(actor, {
      action: "department.created",
      entity: "department",
      entityId: id,
      summary: `${actor.name} created the ${input.name} department.`,
    });
    const row = find(id);
    if (!row) throw notFound("The department could not be saved.");
    return row;
  });

  publish("departments", "created", created.id);
  return created;
}

export function updateDepartment(
  id: string,
  input: DepartmentInput,
  actor: AuthSession,
): Department {
  const current = find(id);
  if (!current) throw notFound("That department no longer exists.");

  const updated = tx(() => {
    run(
      `UPDATE departments
          SET name = ?, code = ?, head = ?, location = ?, phone = ?, email = ?, active = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.name,
        input.code.toUpperCase(),
        input.head,
        input.location,
        input.phone,
        input.email,
        toInt(input.active),
        now(),
        id,
      ],
    );
    audit(actor, {
      action: "department.updated",
      entity: "department",
      entityId: id,
      summary: `${actor.name} updated the ${input.name} department.`,
    });
    const row = find(id);
    if (!row) throw notFound("That department no longer exists.");
    return row;
  });

  publish("departments", "updated", id);
  return updated;
}

export function deleteDepartment(id: string, actor: AuthSession): void {
  const current = find(id);
  if (!current) throw notFound("That department no longer exists.");

  const staff = get<{ c: number }>("SELECT COUNT(*) AS c FROM teachers WHERE department_id = ?", [
    id,
  ]);
  if ((staff?.c ?? 0) > 0) {
    throw conflict(
      `${current.name} still has ${staff?.c} staff member(s). Reassign them before deleting it.`,
    );
  }

  tx(() => {
    run("DELETE FROM departments WHERE id = ?", [id]);
    audit(actor, {
      action: "department.deleted",
      entity: "department",
      entityId: id,
      summary: `${actor.name} deleted the ${current.name} department.`,
    });
  });

  publish("departments", "deleted", id);
}

export { listDepartments };
