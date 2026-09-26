import { GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { listVehicles } from "@/lib/server/repo";
import { recordEntry } from "@/lib/server/services/vehicles";
import { parse, vehicleSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authedRoute(GATE_ROLES, () => listVehicles());
}

export async function POST(request: Request) {
  return mutationRoute(GATE_ROLES, async (session) =>
    recordEntry(parse(vehicleSchema, await readBody(request)), session),
  );
}
