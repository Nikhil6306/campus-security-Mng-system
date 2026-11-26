import { NextResponse } from "next/server";

import { bootstrap } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { resetToSeed } from "@/lib/server/seed";
import { publish } from "@/lib/server/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Restores the demonstration dataset.
 *
 * This deletes every record in the database, so it is restricted to the super
 * administrator and refuses to run once the deployment is marked as production
 * data (`ALLOW_DEMO_RESET=false`).
 */
export async function POST() {
  bootstrap();
  try {
    await requireRole("super_admin");
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "Only the super administrator may reset demo data.", code: "forbidden" } },
      { status: 403 },
    );
  }

  if (process.env.ALLOW_DEMO_RESET === "false") {
    return NextResponse.json(
      { ok: false, error: { message: "Demo reset is disabled on this deployment.", code: "forbidden" } },
      { status: 403 },
    );
  }

  resetToSeed();
  publish("database", "reset");
  return NextResponse.json({ ok: true, data: { reset: true } });
}
