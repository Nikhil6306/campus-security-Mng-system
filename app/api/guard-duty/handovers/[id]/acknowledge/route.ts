import { NextRequest } from "next/server";
import { GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { acknowledgeHandover } from "@/lib/server/services/guard-duty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  return mutationRoute(GATE_ROLES, async (session) => {
    const body = (await readBody(request)) as {
      discrepancies?: string;
    };

    return acknowledgeHandover(
      id,
      { incomingNotes: body.discrepancies, disputedItems: body.discrepancies },
      session,
    );
  });
}
