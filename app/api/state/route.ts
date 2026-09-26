import { NextResponse } from "next/server";

import { bootstrap } from "@/lib/server/http";
import { currentSession } from "@/lib/server/auth";
import { buildSnapshot } from "@/lib/server/services/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The caller's role-scoped view of the database.
 *
 * A signed-out caller receives an empty snapshot with a null session rather
 * than a 401, so the public site can share the same data provider without
 * treating "not signed in" as a failure.
 */
export async function GET() {
  bootstrap();
  const session = await currentSession();
  return NextResponse.json({
    ok: true,
    data: { session, state: buildSnapshot(session) },
  });
}
