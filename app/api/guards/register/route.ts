import { NextResponse } from "next/server";
import { bootstrap, readBody } from "@/lib/server/http";
import { AppError } from "@/lib/server/errors";
import { createGuardRegistrationRequest } from "@/lib/server/services/guards";

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

    const { fullName, email, phone, guardId, password, designation, assignedGate } = body as Record<string, string>;

    if (!fullName || !fullName.trim()) {
      return NextResponse.json(
        { ok: false, error: { message: "Full Name is required.", code: "bad_request" } },
        { status: 400 },
      );
    }
    if (!email || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { ok: false, error: { message: "A valid email address is required.", code: "bad_request" } },
        { status: 400 },
      );
    }
    if (!phone || phone.trim().length < 10) {
      return NextResponse.json(
        { ok: false, error: { message: "A valid 10-digit mobile number is required.", code: "bad_request" } },
        { status: 400 },
      );
    }
    if (!guardId || !guardId.trim()) {
      return NextResponse.json(
        { ok: false, error: { message: "Guard ID / Employee ID is required.", code: "bad_request" } },
        { status: 400 },
      );
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { ok: false, error: { message: "Password must be at least 6 characters.", code: "bad_request" } },
        { status: 400 },
      );
    }

    const req = createGuardRegistrationRequest({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      guardId: guardId.trim(),
      password,
      designation: designation?.trim(),
      assignedGate: assignedGate?.trim(),
    });

    return NextResponse.json({
      ok: true,
      message:
        "Your registration request has been submitted successfully. Your account is waiting for Admin approval. You will receive an email after approval.",
      data: {
        id: req.id,
        fullName: req.full_name,
        email: req.email,
        guardId: req.guard_id,
        status: req.status,
        assignedGate: req.assigned_gate,
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
