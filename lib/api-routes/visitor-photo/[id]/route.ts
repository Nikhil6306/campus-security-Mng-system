import { NextResponse } from "next/server";

import { requireRole } from "@/lib/server/auth";
import { bootstrap, STAFF_ROLES } from "@/lib/server/http";
import { readPhoto } from "@/lib/server/photo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Serves one visitor photograph to signed-in campus staff.
 *
 * This is the only way a stored photograph can be read. The id is 24 random
 * bytes, but the id is not the control — the session check is. An unauthorised
 * caller gets 401 whether or not the id happens to exist, so the endpoint
 * cannot be used to discover which ids are real.
 *
 * `STAFF_ROLES` mirrors the `is_staff()` storage policy in the Supabase
 * deployment: administrators, the gate and hosts. A host only ever learns an
 * id from a booking addressed to them, because the snapshot they receive
 * contains no other booking.
 *
 * `no-store` keeps a visitor's face out of shared caches and proxies.
 */
export async function GET(_request: Request, { params }: Params) {
  bootstrap();

  try {
    await requireRole(...STAFF_ROLES);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "Sign in to view visitor photographs.", code: "unauthorized" },
      },
      { status: 401 },
    );
  }

  const { id } = await params;
  const photo = readPhoto(decodeURIComponent(id));
  if (!photo) {
    return NextResponse.json(
      { ok: false, error: { message: "That photograph is no longer on record.", code: "not_found" } },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(photo.body), {
    status: 200,
    headers: {
      "Content-Type": photo.contentType,
      "Content-Length": String(photo.bytes),
      "Cache-Control": "no-store, private",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
