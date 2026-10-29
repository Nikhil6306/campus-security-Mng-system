import { NextRequest } from "next/server";
import { ADMIN_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { decideHandover } from "@/lib/server/services/guard-duty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const body = (await readBody(request)) as {
      decision: "Approved" | "Rejected" | "Escalation";
      notes?: string;
      rejectionReason?: string;
    };

    const mappedDecision = body.decision === "Escalation" ? "Escalated" : body.decision;
    return decideHandover(
      id,
      mappedDecision as any,
      { notes: body.notes, rejectionReason: body.rejectionReason },
      session,
    );
  });
}
