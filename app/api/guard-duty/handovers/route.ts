import { NextRequest } from "next/server";
import { GATE_ROLES, authedRoute } from "@/lib/server/http";
import { listHandovers } from "@/lib/server/services/guard-duty";
import type { HandoverStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return authedRoute(GATE_ROLES, async () => {
    const { searchParams } = new URL(request.url);
    const gate = searchParams.get("gate") || undefined;
    const outgoingGuardId = searchParams.get("outgoingGuardId") || undefined;
    const incomingGuardId = searchParams.get("incomingGuardId") || undefined;
    const status = (searchParams.get("status") as HandoverStatus) || undefined;
    const date = searchParams.get("date") || undefined;

    return listHandovers({
      gate,
      guardId: outgoingGuardId || incomingGuardId,
      status,
      date,
    });
  });
}
