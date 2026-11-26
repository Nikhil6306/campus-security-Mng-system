import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AuthError, SESSION_COOKIE } from "@/lib/server/auth";
import { bootstrap, isSecureRequest, readBody } from "@/lib/server/http";
import { verifyPasswordResetOtp } from "@/lib/server/services/otp";
import { parse, verifyOtpSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    bootstrap();
    const input = parse(verifyOtpSchema, await readBody(request));
    const result = await verifyPasswordResetOtp(input.email, input.otp);

    // Set recovery token in session cookie so subsequent reset password calls are authorized
    if (result.recoveryToken) {
      const store = await cookies();
      store.set(SESSION_COOKIE, result.recoveryToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureRequest(request),
        path: "/",
        maxAge: 15 * 60, // 15 minutes recovery window
      });
    }

    return NextResponse.json({
      ok: true,
      data: { recoveryToken: result.recoveryToken },
      message: result.message,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: { message: error.message, code: "auth_error" } },
        { status: error.status },
      );
    }
    const status = (error as { status?: number }).status ?? 400;
    const message =
      (error as { message?: string }).message ?? "Could not verify code. Please try again.";
    const details = (error as { details?: Record<string, string> }).details;
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request", details } },
      { status },
    );
  }
}
