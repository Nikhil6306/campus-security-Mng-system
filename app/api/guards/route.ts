import { ADMIN_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { createGuard, guardRoster } from "@/lib/server/services/guards";
import { guardSchema, parse } from "@/lib/server/validation";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startOfToday = () => `${todayISO()}T00:00:00.000Z`;

/** Roster plus each guard's counters for today. */
export async function GET() {
  return authedRoute(ADMIN_ROLES, () => guardRoster(startOfToday()));
}

export async function POST(request: Request) {
  return mutationRoute(ADMIN_ROLES, async (session) =>
    createGuard(parse(guardSchema, await readBody(request)), session),
  );
}
