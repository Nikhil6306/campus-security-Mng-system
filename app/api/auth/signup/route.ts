import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AuthError, SESSION_COOKIE, signUp } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { bootstrap, isSecureRequest, readBody } from "@/lib/server/http";
import { buildSnapshot } from "@/lib/server/services/snapshot";
import { parse, signupSchema } from "@/lib/server/validation";
import { ROLE_LABELS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handles user registration via Supabase Auth.
 * Default role is Visitor, students can sign up as Student.
 */
export async function POST(request: Request) {
  try {
    bootstrap();
    const input = parse(signupSchema, await readBody(request));
    const result = await signUp(
      input.email,
      input.password,
      input.fullName,
      input.role,
      input.phone,
    );

    if (result.session && result.token) {
      audit(result.session, {
        action: "auth.signup",
        entity: "user",
        entityId: result.session.userId,
        summary: `${result.session.name} registered as ${ROLE_LABELS[result.session.role]}.`,
      });

      const store = await cookies();
      store.set(SESSION_COOKIE, result.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureRequest(request),
        path: "/",
        maxAge: 12 * 60 * 60,
      });

      return NextResponse.json({
        ok: true,
        data: result.session,
        message: result.message,
        state: buildSnapshot(result.session),
      });
    }

    return NextResponse.json({
      ok: true,
      data: null,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: { message: error.message, code: "signup_error" } },
        { status: error.status },
      );
    }
    const status = (error as { status?: number }).status ?? 400;
    const message =
      (error as { message?: string }).message ?? "Could not create account. Please check your details.";
    const details = (error as { details?: Record<string, string> }).details;
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request", details } },
      { status },
    );
  }
}
