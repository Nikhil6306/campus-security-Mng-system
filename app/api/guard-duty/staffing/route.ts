import { NextRequest } from "next/server";
import { ADMIN_ROLES, GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { getStaffingRequirements, setStaffingRequirement } from "@/lib/server/services/guard-duty";
import type { ShiftType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authedRoute(GATE_ROLES, async () => {
    return getStaffingRequirements();
  });
}

export async function POST(request: NextRequest) {
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const body = (await readBody(request)) as {
      gate: string;
      shiftType: ShiftType;
      requiredGuards: number;
      notes?: string;
    };

    const minGuards = body.requiredGuards || 1;
    const idealGuards = body.requiredGuards || 1;
    return setStaffingRequirement(body.gate, body.shiftType, minGuards, idealGuards, session);
  });
}
