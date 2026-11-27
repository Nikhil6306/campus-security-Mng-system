import { GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { listEmergencies } from "@/lib/server/repo";
import { triggerEmergency } from "@/lib/server/services/emergency";
import { emergencySchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authedRoute(GATE_ROLES, () => listEmergencies());
}

/**
 * Raises a campus alert. This notifies dashboards inside this system only —
 * it does not and must not contact emergency services.
 */
export async function POST(request: Request) {
  return mutationRoute(GATE_ROLES, async (session) =>
    triggerEmergency(parse(emergencySchema, await readBody(request)), session),
  );
}
