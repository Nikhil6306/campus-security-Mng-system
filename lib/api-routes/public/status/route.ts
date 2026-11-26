import { NextResponse } from "next/server";

import { bootstrap, publicRoute, readBody } from "@/lib/server/http";
import { notFound } from "@/lib/server/errors";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { findVisit, listCheckLogs } from "@/lib/server/repo";
import { publicBookingView } from "@/lib/server/services/snapshot";
import { lookupSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Visitor self-service lookup.
 *
 * Requires the booking reference *and* the mobile number it was made with, so
 * knowing a reference alone reveals nothing. A wrong pair returns exactly the
 * same "not found" as an unknown reference — confirming that a reference exists
 * would itself be a disclosure — and attempts are rate limited.
 */
export async function POST(request: Request) {
  bootstrap();
  const limit = rateLimit(clientKey(request, "status"), 12, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "Too many lookups. Please wait a few minutes and try again.",
          code: "rate_limited",
        },
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  return publicRoute(async () => {
    const input = parse(lookupSchema, await readBody(request));
    const booking = findVisit(input.bookingId);
    const miss = notFound("We could not find a booking with that reference and mobile number.");
    if (!booking) throw miss;
    if (booking.mobile.replace(/[\s-]/g, "") !== input.mobile) throw miss;

    const timeline = listCheckLogs()
      .filter((log) => log.visitRequestId === booking.id)
      .map((log) => ({ direction: log.direction, gate: log.gate, at: log.at }));

    return { booking: publicBookingView(booking), timeline };
  });
}
