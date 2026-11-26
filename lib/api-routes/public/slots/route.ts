import { publicRoute } from "@/lib/server/http";
import { badRequest } from "@/lib/server/errors";
import { availableSlots } from "@/lib/server/services/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bookable slots for a host on a date.
 *
 * Returns times and whether each is open — no visitor names, so the schedule
 * cannot be read off the public endpoint.
 */
export async function GET(request: Request) {
  return publicRoute(() => {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const hostId = url.searchParams.get("hostId");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("Choose a valid date.");
    return { date, hostId, slots: availableSlots(hostId, date) };
  });
}
