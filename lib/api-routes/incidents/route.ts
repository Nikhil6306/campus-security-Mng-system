import { GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { listIncidents } from "@/lib/server/repo";
import { reportIncident } from "@/lib/server/services/incidents";
import { incidentSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authedRoute(GATE_ROLES, () => listIncidents());
}

/** Guards report incidents; administrators can too. */
export async function POST(request: Request) {
  return mutationRoute(GATE_ROLES, async (session) =>
    reportIncident(parse(incidentSchema, await readBody(request)), session),
  );
}
