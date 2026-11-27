import { GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { forbidden } from "@/lib/server/errors";
import { updateIncident } from "@/lib/server/services/incidents";
import { incidentPatchSchema, parse } from "@/lib/server/validation";
import { isAdminRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Triage.
 *
 * A guard may add detail to an incident, but closing one and assigning it to a
 * colleague are administrator decisions — the person who reported an incident
 * should not be the person who declares it resolved.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(GATE_ROLES, async (session) => {
    const patch = parse(incidentPatchSchema, await readBody(request));
    if (!isAdminRole(session.role)) {
      if (patch.status === "Resolved" || patch.status === "Closed") {
        throw forbidden("Only an administrator may close an incident.");
      }
      if (patch.assignedToId !== undefined) {
        throw forbidden("Only an administrator may assign an incident.");
      }
    }
    return updateIncident(id, patch, session);
  });
}
