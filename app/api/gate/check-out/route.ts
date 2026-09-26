import { GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { checkOut } from "@/lib/server/services/gate";
import { checkOutSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return mutationRoute(GATE_ROLES, async (session) => {
    const input = parse(checkOutSchema, await readBody(request));
    return checkOut(input.bookingId, input.gate, session, input.note);
  });
}
