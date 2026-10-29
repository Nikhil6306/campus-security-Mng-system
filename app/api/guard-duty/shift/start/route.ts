import { NextRequest } from "next/server";
import { GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { startGuardShift } from "@/lib/server/services/guard-duty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return mutationRoute(GATE_ROLES, async (session) => {
    const body = (await readBody(request)) as {
      assignmentId: string;
      notes?: string;
    };

    return startGuardShift(body.assignmentId, body.notes, session);
  });
}
