import { NextRequest } from "next/server";
import { GATE_ROLES, authedRoute } from "@/lib/server/http";
import { getLiveHandoverData } from "@/lib/server/services/guard-duty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return authedRoute(GATE_ROLES, async () => {
    const { searchParams } = new URL(request.url);
    const gate = searchParams.get("gate") || undefined;

    return getLiveHandoverData(gate);
  });
}
