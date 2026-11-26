import { NextResponse } from "next/server";

import { AuthError } from "@/lib/server/auth";
import { bootstrap, readBody } from "@/lib/server/http";
import { createAndSendOtp } from "@/lib/server/services/otp";
import { parse, sendOtpSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    bootstrap();
    const input = parse(sendOtpSchema, await readBody(request));
    const result = await createAndSendOtp({
      email: input.email,
      purpose: input.purpose,
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
      (error as { message?: string }).message ?? "Could not send verification code.";
    const details = (error as { details?: Record<string, string> }).details;
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request", details } },
      { status },
    );
  }
}
