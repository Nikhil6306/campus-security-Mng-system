import { NextResponse } from "next/server";

import { AuthError, currentSession } from "@/lib/server/auth";
import { bootstrap, readBody } from "@/lib/server/http";
import { verifyOldEmailOtp } from "@/lib/server/services/email-change";
import { changeEmailOtpSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step 2: Verifies OTP sent to the old registered email.
 * On success, sends confirmation OTP to the new email address.
 */
export async function POST(request: Request) {
  try {
    bootstrap();
    const session = await currentSession();
    if (!session) {
      throw new AuthError("You must be signed in to change your email.", 401);
    }

    const input = parse(changeEmailOtpSchema, await readBody(request));
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    const result = await verifyOldEmailOtp({
      userId: session.userId,
      otp: input.otp,
      userName: session.name,
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({ ok: true, data: result, message: result.message });
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
