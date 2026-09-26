import "server-only";

import type { AppNotification, AuthSession, NotificationType, Role } from "@/lib/types";
import { nextId, run } from "./db";

/**
 * Audit trail and notifications.
 *
 * Both are written inside the caller's transaction, so an action and its record
 * of having happened either both land or neither does.
 *
 * Deliberately not recorded: IP addresses, user agents and device fingerprints.
 * The audit requirement here is "who changed what, and when" — collecting more
 * than that about staff movements would be personal data this system has no
 * need for.
 */

export type Actor = Pick<AuthSession, "userId" | "name" | "role"> | null;

const SYSTEM: { id: null; name: string; role: "system" } = {
  id: null,
  name: "System",
  role: "system",
};

export interface AuditInput {
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  channel?: string;
}

/** Appends one row to `activity_logs`. Call inside a transaction. */
export function audit(actor: Actor, input: AuditInput): void {
  const who = actor
    ? { id: actor.userId, name: actor.name, role: actor.role as Role | "system" }
    : SYSTEM;
  run(
    `INSERT INTO activity_logs
       (id, actor_id, actor_name, actor_role, action, entity, entity_id, summary, channel, at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      nextId("ACT", { pad: 6 }),
      who.id,
      who.name,
      who.role,
      input.action,
      input.entity,
      input.entityId,
      input.summary,
      input.channel ?? "web",
      new Date().toISOString(),
    ],
  );
}

export interface NotifyInput {
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
  /** Role to address; omit to reach every staff dashboard. */
  audience?: Role | null;
}

/** Appends one row to `notifications`. Call inside a transaction. */
export function notify(input: NotifyInput): AppNotification {
  const id = nextId("NTF", { pad: 5 });
  const at = new Date().toISOString();
  run(
    "INSERT INTO notifications(id, type, title, message, href, audience, read, at) VALUES (?,?,?,?,?,?,0,?)",
    [id, input.type, input.title, input.message, input.href ?? null, input.audience ?? null, at],
  );
  return {
    id,
    type: input.type,
    title: input.title,
    message: input.message,
    href: input.href,
    audience: input.audience ?? null,
    read: false,
    at,
  };
}
