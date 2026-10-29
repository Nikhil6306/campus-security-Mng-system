import { NextRequest } from "next/server";
import { GATE_ROLES, authedRoute } from "@/lib/server/http";
import { getPatrolRoutes, getCheckpointsForRoute } from "@/lib/server/services/guard-duty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return authedRoute(GATE_ROLES, async () => {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get("routeId");

    if (routeId) {
      return getCheckpointsForRoute(routeId);
    }

    return getPatrolRoutes();
  });
}
