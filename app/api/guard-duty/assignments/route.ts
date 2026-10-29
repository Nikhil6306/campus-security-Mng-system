import { NextRequest } from "next/server";
import { ADMIN_ROLES, GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { createGuardAssignment, listGuardAssignments } from "@/lib/server/services/guard-duty";
import type { ShiftType, AssignmentStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return authedRoute(GATE_ROLES, async () => {
    const { searchParams } = new URL(request.url);
    const gate = searchParams.get("gate") || undefined;
    const guardId = searchParams.get("guardId") || undefined;
    const date = searchParams.get("date") || undefined;
    const shiftType = (searchParams.get("shiftType") as ShiftType) || undefined;
    const status = (searchParams.get("status") as AssignmentStatus) || undefined;

    return listGuardAssignments({ gate, guardId, date, shift: shiftType, status });
  });
}

export async function POST(request: NextRequest) {
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const body = (await readBody(request)) as {
      guardId: string;
      guardName?: string;
      gate: string;
      dutyDate: string;
      shiftType: ShiftType;
      startTime?: string;
      endTime?: string;
      scheduledStartTime?: string;
      scheduledEndTime?: string;
      notes?: string;
    };

    const startTime = body.startTime || body.scheduledStartTime || "06:00";
    const endTime = body.endTime || body.scheduledEndTime || "14:00";

    return createGuardAssignment(
      {
        guardId: body.guardId,
        gate: body.gate,
        dutyDate: body.dutyDate,
        shiftType: body.shiftType,
        startTime,
        endTime,
        notes: body.notes,
      },
      session,
    );
  });
}
