import { ADMIN_ROLES, GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { deleteVehicle, recordExit, recordReEntry, updateVehicle } from "@/lib/server/services/vehicles";
import { parse, vehiclePatchSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(GATE_ROLES, async (session) => {
    const patch = parse(vehiclePatchSchema, await readBody(request));
    switch (patch.action) {
      case "exit":
        return recordExit(id, session);
      case "re-enter":
        return recordReEntry(id, session, patch.gate);
      default:
        return updateVehicle(id, patch, session);
    }
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, (session) => {
    deleteVehicle(id, session);
    return { id };
  });
}
