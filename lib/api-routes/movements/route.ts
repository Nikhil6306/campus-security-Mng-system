import { GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { logMovement } from "@/lib/server/services/students";
import { movementSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return mutationRoute(GATE_ROLES, async (session) =>
    logMovement(parse(movementSchema, await readBody(request)), session),
  );
}
