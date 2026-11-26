import { ADMIN_ROLES, GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import {
  assignGuardToGate,
  deleteGate,
  gateDetail,
  updateGate,
} from "@/lib/server/services/gates";
import { gateAssignSchema, gateSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return authedRoute(GATE_ROLES, () => gateDetail(id));
}

/**
 * Two writes share this verb: editing the gate itself, and posting a guard to
 * it. `action: "assign"` picks the second — the body shape decides nothing.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await readBody(request)) as { action?: string };

  if (body?.action === "assign") {
    return mutationRoute(ADMIN_ROLES, async (session) => {
      const { guardId } = parse(gateAssignSchema, body);
      const gate = gateDetail(id);
      return assignGuardToGate(guardId, gate.location.name, session);
    });
  }

  return mutationRoute(ADMIN_ROLES, (session) => updateGate(id, parse(gateSchema, body), session));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, (session) => {
    deleteGate(id, session);
    return { id };
  });
}
