import { NextResponse } from "next/server";

import { bootstrap, publicRoute } from "@/lib/server/http";
import { badRequest } from "@/lib/server/errors";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { savePhoto } from "@/lib/server/photo-store";
import { MAX_PHOTO_BYTES, PHOTO_MESSAGES } from "@/lib/photo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Visitor photograph upload, during pre-booking.
 *
 * Unauthenticated by necessity — the photograph is taken before the booking
 * exists and the visitor has no account. What keeps that safe:
 *
 *  - the response is an opaque id, never a URL, so an uploader learns nothing
 *    that lets them read anything back;
 *  - reading a photograph requires a staff session on a different route;
 *  - the bytes are sniffed, so only a real JPEG, PNG or WebP is written;
 *  - the size cap is enforced before the body is buffered; and
 *  - uploads are rate limited per client.
 *
 * An id that is never attached to a booking simply goes unreferenced; it is
 * not reachable, because nothing can read a photo without a staff session.
 */
export async function POST(request: Request) {
  bootstrap();

  const limit = rateLimit(clientKey(request, "visitor-photo"), 12, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "Too many photo uploads. Please wait a few minutes and try again.",
          code: "rate_limited",
        },
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  // Refuse an oversized body on the declared length before reading it, so a
  // large upload cannot occupy the server just to be rejected afterwards.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PHOTO_BYTES + 8 * 1024) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: PHOTO_MESSAGES.size,
          code: "validation_failed",
          details: { photoId: PHOTO_MESSAGES.size },
        },
      },
      { status: 413 },
    );
  }

  return publicRoute(async () => {
    let file: File | null = null;
    try {
      const form = await request.formData();
      const candidate = form.get("photo");
      if (candidate instanceof File) file = candidate;
    } catch {
      throw badRequest(PHOTO_MESSAGES.corrupt, { photoId: PHOTO_MESSAGES.corrupt });
    }

    if (!file) throw badRequest(PHOTO_MESSAGES.required, { photoId: PHOTO_MESSAGES.required });

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = savePhoto(buffer, file.type);

    // Only the id travels back. The storage path stays server-side, and the
    // photograph itself is readable only through the staff route.
    return { photoId: stored.id, bytes: stored.bytes, contentType: stored.contentType };
  });
}
