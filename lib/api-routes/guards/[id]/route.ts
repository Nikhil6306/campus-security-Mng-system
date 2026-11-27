import { ADMIN_ROLES, GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { forbidden, notFound } from "@/lib/server/errors";
import { deleteGuard, guardProfile, updateGuard } from "@/lib/server/services/guards";
import { guardSchema, parse } from "@/lib/server/validation";
import { isAdminRole } from "@/lib/types";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Full profile. A guard may open their own; administrators may open any. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return authedRoute(GATE_ROLES, (session) => {
    if (!isAdminRole(session.role) && session.refId !== id) {
      throw forbidden("You can only view your own guard profile.");
    }
    const profile = guardProfile(id, `${todayISO()}T00:00:00.000Z`);
    if (!profile) throw notFound("That guard is not on the roster.");
    return profile;
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, async (session) =>
    updateGuard(id, parse(guardSchema, await readBody(request)), session),
  );
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, (session) => {
    deleteGuard(id, session);
    return { id };
  });
}
