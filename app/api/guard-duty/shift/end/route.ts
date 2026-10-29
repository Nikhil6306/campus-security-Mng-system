import { NextRequest } from "next/server";
import { GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { endGuardShift } from "@/lib/server/services/guard-duty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return mutationRoute(GATE_ROLES, async (session) => {
    const body = (await readBody(request)) as {
      sessionId: string;
      shiftSummary: string;
      equipmentHandoverNotes?: string;
      incomingGuardId?: string;
      incomingGuardName?: string;
    };

    return endGuardShift(body, session);
  });
}
