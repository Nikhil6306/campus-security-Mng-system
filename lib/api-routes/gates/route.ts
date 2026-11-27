import { ADMIN_ROLES, GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { createGate, gateRoster } from "@/lib/server/services/gates";
import { gateSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The gate roster with live traffic. Guards need it to see their own post. */
export async function GET() {
  return authedRoute(GATE_ROLES, () => gateRoster());
}

export async function POST(request: Request) {
  return mutationRoute(ADMIN_ROLES, async (session) =>
    createGate(parse(gateSchema, await readBody(request)), session),
  );
}
