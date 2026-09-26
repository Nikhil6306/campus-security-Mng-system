import { z } from "zod";

import { ADMIN_ROLES, STAFF_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { forbidden, notFound } from "@/lib/server/errors";
import { findVisit } from "@/lib/server/repo";
import {
  approveBooking,
  cancelBooking,
  completeMeeting,
  markNoShow,
  rejectBooking,
  rescheduleBooking,
  startMeeting,
} from "@/lib/server/services/bookings";
import { isAdminRole } from "@/lib/types";
import { parse, rejectSchema, rescheduleSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const actionSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "reschedule",
    "cancel",
    "no-show",
    "start-meeting",
    "complete-meeting",
  ]),
});

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return authedRoute(STAFF_ROLES, (session) => {
    const booking = findVisit(id);
    if (!booking) throw notFound("No booking found for that reference.");
    // A host may only open the bookings addressed to them.
    if (session.role === "teacher" && booking.hostId !== session.refId) {
      throw forbidden("That booking is not one of yours.");
    }
    return booking;
  });
}

/**
 * Every decision a booking can receive.
 *
 * Hosts may act on their own meetings; only administrators may approve, reject
 * or move one. The role check happens here rather than in the interface,
 * because hiding a button is not a permission.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(STAFF_ROLES, async (session) => {
    const body = (await readBody(request)) as Record<string, unknown>;
    const { action } = parse(actionSchema, body);

    const booking = findVisit(id);
    if (!booking) throw notFound("No booking found for that reference.");

    const admin = isAdminRole(session.role);
    const isHost = session.role === "teacher" && booking.hostId === session.refId;
    if (!admin && !isHost && session.role !== "security") {
      throw forbidden("That booking is not one of yours.");
    }

    switch (action) {
      case "approve":
        if (!admin && !isHost) throw forbidden("Only the host or an administrator may approve a visit.");
        return approveBooking(id, session);
      case "reject": {
        if (!admin && !isHost) throw forbidden("Only the host or an administrator may reject a visit.");
        const { reason } = parse(rejectSchema, body);
        return rejectBooking(id, reason, session);
      }
      case "reschedule": {
        if (!admin && !isHost) throw forbidden("Only the host or an administrator may move a visit.");
        const { visitDate, visitTime } = parse(rescheduleSchema, body);
        return rescheduleBooking(id, visitDate, visitTime, session);
      }
      case "cancel":
        if (!ADMIN_ROLES.includes(session.role)) {
          throw forbidden("Only an administrator may cancel a booking.");
        }
        return cancelBooking(id, session, typeof body.reason === "string" ? body.reason : undefined);
      case "no-show":
        if (!admin && session.role !== "security") {
          throw forbidden("Only security or an administrator may record a no-show.");
        }
        return markNoShow(id, session);
      case "start-meeting":
        if (!admin && !isHost) throw forbidden("Only the host or an administrator may start a meeting.");
        return startMeeting(id, session);
      case "complete-meeting":
        if (!admin && !isHost) throw forbidden("Only the host or an administrator may complete a meeting.");
        return completeMeeting(id, session);
    }
  });
}
