import { STAFF_ROLES, mutationRoute } from "@/lib/server/http";
import { markAllRead } from "@/lib/server/services/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Marks every notification the caller's role can see as read. */
export async function PATCH() {
  return mutationRoute(STAFF_ROLES, (session) => ({ updated: markAllRead(session) }));
}
