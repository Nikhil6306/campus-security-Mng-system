import { NextResponse } from "next/server";

import { AuthError, requestPasswordReset } from "@/lib/server/auth";
import { bootstrap, readBody } from "@/lib/server/http";
import { forgotPasswordSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    bootstrap();
    const input = parse(forgotPasswordSchema, await readBody(request));
    const url = new URL(request.url);
    const redirectTo = `${url.origin}/reset-password`;

    const result = await requestPasswordReset(input.email, redirectTo);
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
      (error as { message?: string }).message ?? "Could not send password reset email.";
    const details = (error as { details?: Record<string, string> }).details;
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request", details } },
      { status },
    );
  }
}
