import { NextRequest } from "next/server";
import { GATE_ROLES, authedRoute } from "@/lib/server/http";
import { getHandoverDetails } from "@/lib/server/services/guard-duty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  return authedRoute(GATE_ROLES, async () => {
    return getHandoverDetails(id);
  });
}
