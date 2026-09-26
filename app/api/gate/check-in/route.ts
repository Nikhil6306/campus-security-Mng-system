import { GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { checkIn } from "@/lib/server/services/gate";
import { checkInSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return mutationRoute(GATE_ROLES, async (session) => {
    const input = parse(checkInSchema, await readBody(request));
    return checkIn(input.bookingId, input.gate, session, input.note);
  });
}
