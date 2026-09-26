import { GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { updateEmergencyStatus } from "@/lib/server/services/emergency";
import { emergencyPatchSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(GATE_ROLES, async (session) => {
    const { status } = parse(emergencyPatchSchema, await readBody(request));
    return updateEmergencyStatus(id, status, session);
  });
}
