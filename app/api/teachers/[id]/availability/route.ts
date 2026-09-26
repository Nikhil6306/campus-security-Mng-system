import { ADMIN_ROLES, STAFF_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { forbidden } from "@/lib/server/errors";
import { findAvailability } from "@/lib/server/repo";
import { setAvailability, strandedBookings } from "@/lib/server/services/teachers";
import { availabilitySchema, parse } from "@/lib/server/validation";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const MANAGE_ROLES: Role[] = [...ADMIN_ROLES, "teacher"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return authedRoute(STAFF_ROLES, () => findAvailability(id));
}

/** A host manages their own hours; an administrator may manage any host. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(MANAGE_ROLES, async (session) => {
    if (session.role === "teacher" && session.refId !== id) {
      throw forbidden("You can only change your own availability.");
    }
    const input = parse(availabilitySchema, await readBody(request));
    return { availability: setAvailability(id, input, session), stranded: strandedBookings(id) };
  });
}
