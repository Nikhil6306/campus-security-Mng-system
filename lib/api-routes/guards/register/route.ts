import { NextResponse } from "next/server";
import { bootstrap, readBody } from "@/lib/server/http";
import { AppError } from "@/lib/server/errors";
import { createGuardRegistrationRequestAsync } from "@/lib/server/services/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    bootstrap();
    const body = await readBody(request);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: { message: "Invalid request payload.", code: "bad_request" } },
        { status: 400 },
      );
    }

    const { fullName, email, phone, mobileNumber, password } = body as Record<string, string>;
    const contactPhone = phone || mobileNumber;

    if (!fullName || !fullName.trim() || fullName.trim().length < 3) {
      return NextResponse.json(
        { ok: false, error: { message: "Full Name must be at least 3 characters.", code: "bad_request" } },
        { status: 400 },
      );
    }
    if (!email || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { ok: false, error: { message: "A valid email address is required.", code: "bad_request" } },
        { status: 400 },
      );
    }
    if (!contactPhone || contactPhone.trim().length < 10) {
      return NextResponse.json(
        { ok: false, error: { message: "A valid 10-digit Indian mobile number is required (+91 optional).", code: "bad_request" } },
        { status: 400 },
      );
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { ok: false, error: { message: "Password must be at least 6 characters.", code: "bad_request" } },
        { status: 400 },
      );
    }

    const req = await createGuardRegistrationRequestAsync({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: contactPhone.trim(),
      password,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Your guard registration request has been submitted successfully. Your account is currently awaiting Admin approval. You will be able to access the Guard Dashboard after your request is approved.",
      data: {
        id: req.id,
        requestId: req.id,
        fullName: req.full_name,
        email: req.email,
        phone: req.phone,
        guardId: req.guard_id,
        status: req.status,
        createdAt: req.created_at,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: { message: err.message, code: err.code } },
        { status: err.status },
      );
    }
    const message = (err as Error).message || "Internal server error during guard registration.";
    return NextResponse.json(
      { ok: false, error: { message, code: "server_error" } },
      { status: 500 },
    );
  }
}
