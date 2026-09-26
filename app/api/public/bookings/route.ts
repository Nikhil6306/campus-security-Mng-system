import { NextResponse } from "next/server";

import { bootstrap, publicRoute, readBody } from "@/lib/server/http";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { createBooking } from "@/lib/server/services/bookings";
import { publicBookingView } from "@/lib/server/services/snapshot";
import { parse, publicBookingSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public pre-booking.
 *
 * Unauthenticated by design — a visitor has no account yet. The booking is
 * created as `Pending`: nothing here can grant entry, and the response echoes
 * back only what the visitor already told us plus their reference and pass
 * token.
 *
 * Accompanying visitors arrive on the same request and are written in the same
 * transaction. Their Aadhaar numbers are sealed before they touch the database
 * and are never echoed back — the response carries no Aadhaar fragment at all.
 *
 * The visitor's photograph is mandatory and arrives as the opaque id returned
 * by `/api/public/visitor-photo` — never as image bytes on this request. The
 * booking service confirms that id really resolves to a stored file before the
 * row is written, so a fabricated id creates nothing.
 *
 * A repeated submission carrying the same `idempotencyKey` resolves to the
 * booking already created rather than making a second one.
 */
export async function POST(request: Request) {
  bootstrap();
  const limit = rateLimit(clientKey(request, "book"), 8, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "Too many booking attempts. Please wait a few minutes and try again.",
          code: "rate_limited",
        },
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  return publicRoute(async () => {
    const { guests, idempotencyKey, ...input } = parse(
      publicBookingSchema,
      await readBody(request),
    );
    const { booking, replayed } = createBooking(input, null, "Visitor Portal", {
      guests,
      idempotencyKey,
    });
    return { ...publicBookingView(booking), replayed: Boolean(replayed) };
  });
}
