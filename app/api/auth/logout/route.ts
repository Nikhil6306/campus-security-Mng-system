import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, currentSession, signOutToken } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { bootstrap } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Closes the session server-side and clears the cookie. */
export async function POST() {
  bootstrap();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = await currentSession();

  if (session) {
    audit(session, {
      action: "auth.logout",
      entity: "user",
      entityId: session.userId,
      summary: `${session.name} signed out.`,
    });
  }
  if (token) signOutToken(token);

  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true, data: null });
}
