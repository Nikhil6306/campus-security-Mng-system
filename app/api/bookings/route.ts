import { ADMIN_ROLES, GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { createBooking } from "@/lib/server/services/bookings";
import { bookingSchema, parse } from "@/lib/server/validation";
import { listVisits } from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authedRoute(ADMIN_ROLES, () => listVisits());
}

/** Walk-in booking raised at a desk — same rules as the public form. */
export async function POST(request: Request) {
  return mutationRoute(GATE_ROLES, async (session) => {
    const input = parse(bookingSchema, await readBody(request));
    const source = session.role === "security" ? "Security Desk" : "Walk-in";
    return createBooking(input, session, source).booking;
  });
}
