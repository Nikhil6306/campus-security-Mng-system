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

  // NOTE: Do NOT delete cookies here even when session is null.
  // The sessionForToken() function already handles expired/invalid tokens gracefully.
  // Deleting cookies from an API route causes redirect loops because:
  // 1. Middleware reads csms_session and csms_role to allow the request through.
  // 2. If the state route deletes them, the client becomes unauthenticated.
  // 3. AdminShell fires window.location.replace → infinite redirect.
  // Cookie cleanup happens only during explicit sign-out (/api/auth/logout).

  return NextResponse.json({
    ok: true,
    data: { session, state: buildSnapshot(session) },
  });
}
