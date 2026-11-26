import { NextRequest } from "next/server";
import { GATE_ROLES, authedRoute } from "@/lib/server/http";
import { listPatrolSubmissions } from "@/lib/server/services/guard-duty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return authedRoute(GATE_ROLES, async (session) => {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId") || undefined;
    const checkpointId = searchParams.get("checkpointId") || undefined;
    const guardId = searchParams.get("guardId") || undefined;
    const status = searchParams.get("status") || undefined;

    return listPatrolSubmissions({ sessionId, checkpointId, guardId, status });
  });
}
