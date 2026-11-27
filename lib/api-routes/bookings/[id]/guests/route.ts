import { authedRoute, STAFF_ROLES } from "@/lib/server/http";
import { forbidden, notFound } from "@/lib/server/errors";
import { findVisit, listGuests } from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * The accompanying party on one booking, for staff.
 *
 * Scoped exactly like the booking itself: a host sees only the parties on
 * their own meetings. The rows returned by `listGuests` never carry a full
 * Aadhaar number — the mapper exposes the last four digits only — so this
 * endpoint cannot leak one even to an authorised caller.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return authedRoute(STAFF_ROLES, (session) => {
    const booking = findVisit(id);
    if (!booking) throw notFound("No booking found for that reference.");
    if (session.role === "teacher" && booking.hostId !== session.refId) {
      throw forbidden("That booking is not one of yours.");
    }
    return listGuests(booking.id);
  });
}
