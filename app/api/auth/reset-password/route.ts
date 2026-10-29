import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AuthError, SESSION_COOKIE, resetPassword } from "@/lib/server/auth";
import { bootstrap, readBody } from "@/lib/server/http";
import { parse, resetPasswordSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    bootstrap();
    const input = parse(resetPasswordSchema, await readBody(request));

    // Get token from Authorization header or cookie
    const authHeader = request.headers.get("authorization");
    let token = authHeader?.replace(/^Bearer\s+/i, "")?.trim();
    if (!token) {
      const store = await cookies();
      token = store.get(SESSION_COOKIE)?.value;
    }

    if (!token) {
      throw new AuthError("Session expired or invalid reset link. Please request a new one.", 401);
    }

    const result = await resetPassword(token, input.password);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: { message: error.message, code: "auth_error" } },
        { status: error.status },
      );
    }
    const status = (error as { status?: number }).status ?? 400;
    const message =
      (error as { message?: string }).message ?? "Could not reset password. Please try again.";
    const details = (error as { details?: Record<string, string> }).details;
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request", details } },
      { status },
    );
  }
}
