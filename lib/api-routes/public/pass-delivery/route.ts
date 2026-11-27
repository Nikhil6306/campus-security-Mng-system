import { NextResponse } from "next/server";

import { bootstrap, publicRoute, readBody } from "@/lib/server/http";
import { notFound } from "@/lib/server/errors";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { findVisit } from "@/lib/server/repo";
import { deliverPass, deliveryReport } from "@/lib/server/services/pass";
import { parse, passDeliverySchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends the visitor's own pass to their own WhatsApp number.
 *
 * Authorised exactly like the status lookup: the caller must present the
 * booking reference *and* the mobile number the booking was made with, and a
 * mismatch returns the same "not found" as an unknown reference so the
 * endpoint cannot be used to test whether a reference exists.
 *
 * The recipient is never taken from the request — the message always goes to
 * the number stored on the booking, so this cannot be turned into a relay for
 * sending WhatsApp messages to arbitrary numbers.
 */
export async function POST(request: Request) {
  bootstrap();
  const limit = rateLimit(clientKey(request, "pass-delivery"), 6, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "Too many delivery attempts. Please wait a few minutes and try again.",
          code: "rate_limited",
        },
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  return publicRoute(async () => {
    const input = parse(passDeliverySchema, await readBody(request));
    const booking = findVisit(input.bookingId);

    const miss = notFound("We could not find a booking with that reference and mobile number.");
    if (!booking) throw miss;
    if (booking.mobile.replace(/[\s-]/g, "") !== input.mobile) throw miss;

    return { delivery: await deliverPass(booking.id) };
  });
}

/** Current delivery state, for the success screen to poll after a send. */
export async function PUT(request: Request) {
  bootstrap();
  const limit = rateLimit(clientKey(request, "pass-delivery-status"), 20, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: { message: "Too many requests.", code: "rate_limited" } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  return publicRoute(async () => {
    const input = parse(passDeliverySchema, await readBody(request));
    const booking = findVisit(input.bookingId);

    const miss = notFound("We could not find a booking with that reference and mobile number.");
    if (!booking) throw miss;
    if (booking.mobile.replace(/[\s-]/g, "") !== input.mobile) throw miss;

    return { delivery: deliveryReport(booking.id) };
  });
}
