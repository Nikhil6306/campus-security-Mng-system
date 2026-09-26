import "server-only";

import type { AuthSession } from "@/lib/types";
import { run, tx } from "../db";
import { publish } from "../events";
import { notFound } from "../errors";
import { get } from "../db";

/**
 * Notification inbox.
 *
 * Read state is campus-wide rather than per-user: the security desk works as
 * one queue, and an alert one operator has actioned should not keep flashing
 * for the next. Audience-scoped rows (`audience = 'security'`) narrow who sees
 * a notification in the first place.
 */

export function markRead(id: string, read: boolean, _actor: AuthSession): void {
  const row = get<{ id: string }>("SELECT id FROM notifications WHERE id = ?", [id]);
  if (!row) throw notFound("That notification no longer exists.");
  run("UPDATE notifications SET read = ? WHERE id = ?", [read ? 1 : 0, id]);
  publish("notifications", "updated", id);
}

export function markAllRead(actor: AuthSession): number {
  const changed = tx(() => {
    const result = run(
      "UPDATE notifications SET read = 1 WHERE read = 0 AND (audience IS NULL OR audience = ?)",
      [actor.role],
    );
    return result.changes;
  });
  publish("notifications", "read-all");
  return changed;
}

export function removeNotification(id: string): void {
  const row = get<{ id: string }>("SELECT id FROM notifications WHERE id = ?", [id]);
  if (!row) throw notFound("That notification no longer exists.");
  run("DELETE FROM notifications WHERE id = ?", [id]);
  publish("notifications", "deleted", id);
}
