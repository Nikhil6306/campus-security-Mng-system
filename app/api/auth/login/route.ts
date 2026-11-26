import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AuthError, SESSION_COOKIE, signIn } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { bootstrap, isSecureRequest, readBody } from "@/lib/server/http";
import { buildSnapshot } from "@/lib/server/services/snapshot";
import { logSecurityEvent } from "@/lib/server/services/security-audit";
import { sendNotificationEmail } from "@/lib/email/email-service";
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
    const { session, token } = await signIn(input.email, input.password);

    if (input.expectedRole) {
      const allowed = session.role === input.expectedRole;
      if (!allowed) {
        throw new AuthError(
          "You are not authorized to access this login portal.",
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

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    void logSecurityEvent({
      userId: session.userId,
      eventType: "login_success",
      description: `${session.name} signed in as ${ROLE_LABELS[session.role]}.`,
      ipAddress: clientIp,
      userAgent,
      metadata: { role: session.role, gate: session.gate },
    });

    void sendNotificationEmail({
      toEmail: session.email,
      toName: session.name,
      eventType: "Successful Sign-In",
      eventDescription: `A successful sign-in to your ${ROLE_LABELS[session.role]} account was detected at Dev Sanskriti Vishwavidyalaya.`,
      role: ROLE_LABELS[session.role],
      userId: session.userId,
      subject: "DSVV Campus Security — New Sign-In to Your Account",
    });

    const store = await cookies();
    const isSecure = isSecureRequest(request);
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      // Marked Secure whenever the request actually arrived over TLS, rather
      // than keyed to NODE_ENV: a production build demonstrated over plain
      // http://localhost would otherwise set a cookie the browser refuses to
      // send back, and no one could sign in. Behind a TLS-terminating proxy
      // the forwarded protocol is what counts.
      secure: isSecure,
      path: "/",
      maxAge: 12 * 60 * 60,
    });

    // Set a lightweight role hint cookie readable by the Next.js middleware for
    // role-based routing. This is NOT a security boundary — the actual role is
    // always re-verified server-side in every API route via requireRole().
    store.set("csms_role", session.role, {
      httpOnly: false, // Must be readable by middleware (Edge runtime, no DB access)
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: 12 * 60 * 60,
    });

    return NextResponse.json({
      ok: true,
      data: { ...session, token },
      token,
      state: buildSnapshot(session),
    });
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
