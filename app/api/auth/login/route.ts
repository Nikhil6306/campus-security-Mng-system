import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AuthError, SESSION_COOKIE, signIn } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { bootstrap, isSecureRequest, readBody } from "@/lib/server/http";
import { buildSnapshot } from "@/lib/server/services/snapshot";
import { loginSchema, parse } from "@/lib/server/validation";
import { ROLE_LABELS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opens a session.
 *
 * The session token goes into an httpOnly cookie — unreadable to scripts, so an
 * XSS bug cannot lift a signed-in identity. `expectedRole` lets a portal reject
 * a valid account that belongs somewhere else, which stops a guard landing on
 * the admin console because they used the wrong sign-in page.
 */
export async function POST(request: Request) {
  try {
    bootstrap();
    const input = parse(loginSchema, await readBody(request));
    const { session, token } = signIn(input.email, input.password);

    if (input.expectedRole) {
      const allowed =
        session.role === input.expectedRole ||
        (input.expectedRole === "admin" && session.role === "super_admin");
      if (!allowed) {
        throw new AuthError(
          `That account signs in as ${ROLE_LABELS[session.role]}. Use the matching portal.`,
          403,
        );
      }
    }

    audit(session, {
      action: "auth.login",
      entity: "user",
      entityId: session.userId,
      summary: `${session.name} signed in as ${ROLE_LABELS[session.role]}.`,
    });

    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      // Marked Secure whenever the request actually arrived over TLS, rather
      // than keyed to NODE_ENV: a production build demonstrated over plain
      // http://localhost would otherwise set a cookie the browser refuses to
      // send back, and no one could sign in. Behind a TLS-terminating proxy
      // the forwarded protocol is what counts.
      secure: isSecureRequest(request),
      path: "/",
      maxAge: 12 * 60 * 60,
    });

    return NextResponse.json({ ok: true, data: session, state: buildSnapshot(session) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: { message: error.message, code: "unauthorized" } },
        { status: error.status },
      );
    }
    const status = (error as { status?: number }).status ?? 400;
    const message =
      (error as { message?: string }).message ?? "We could not sign you in. Please try again.";
    const details = (error as { details?: Record<string, string> }).details;
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request", details } },
      { status },
    );
  }
}
