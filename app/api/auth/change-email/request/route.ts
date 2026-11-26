import { NextResponse } from "next/server";

import { AuthError, currentSession } from "@/lib/server/auth";
import { bootstrap, readBody } from "@/lib/server/http";
import { requestEmailChange } from "@/lib/server/services/email-change";
import { changeEmailRequestSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step 1: Initiates an email change request.
 * Requires authenticated session. Sends OTP to the CURRENT registered email.
 */
export async function POST(request: Request) {
  try {
    bootstrap();
    const session = await currentSession();
    if (!session) {
      throw new AuthError("You must be signed in to change your email.", 401);
    }

    const input = parse(changeEmailRequestSchema, await readBody(request));
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    const result = await requestEmailChange({
      userId: session.userId,
      currentEmail: session.email,
      newEmail: input.newEmail,
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
      (error as { message?: string }).message ?? "Could not process email change request.";
    const details = (error as { details?: Record<string, string> }).details;
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request", details } },
      { status },
    );
  }
}
