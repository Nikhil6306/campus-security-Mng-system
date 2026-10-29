import { NextRequest } from "next/server";
import { GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { submitPatrolCheck } from "@/lib/server/services/guard-duty";
import type { CheckpointResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return mutationRoute(GATE_ROLES, async (session) => {
    const body = (await readBody(request)) as {
      assignmentId?: string;
      checkpointId: string;
      result: CheckpointResult;
      observations?: string;
      photoUrl?: string;
    };

    // In case caller passes result instead of status, or assignmentId instead of sessionId
    let sessionId = (body as any).sessionId;
    if (!sessionId && body.assignmentId) {
      // Find active or existing session for this assignment
      const sessionRow = (await import("@/lib/server/db")).get<{ id: string }>(
        "SELECT id FROM guard_shift_sessions WHERE assignment_id = ? ORDER BY checkin_time DESC LIMIT 1",
        [body.assignmentId]
      );
      if (sessionRow) {
        sessionId = sessionRow.id;
      }
    }

    if (!sessionId) {
      // Fallback: look up active session for current guard
      const sessionRow = (await import("@/lib/server/db")).get<{ id: string }>(
        "SELECT id FROM guard_shift_sessions WHERE (guard_id = ? OR guard_name = ?) AND status = 'Active' ORDER BY checkin_time DESC LIMIT 1",
        [session.refId || session.userId, session.name]
      );
      if (sessionRow) {
        sessionId = sessionRow.id;
      }
    }

    if (!sessionId) {
      throw (await import("@/lib/server/errors")).badRequest("No active guard shift session found for this patrol check.");
    }

    const status = (body.result === "Fail" ? "Fail" : body.result === "N/A" ? "N/A" : "Pass") as "Pass" | "Fail" | "N/A";

    return submitPatrolCheck(
      {
        sessionId,
        checkpointId: body.checkpointId,
        status,
        observations: body.observations,
        photoUrl: body.photoUrl,
      },
      session,
    );
  });
}
