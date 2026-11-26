import { NextResponse } from "next/server";
import { z } from "zod";

import { bootstrap, publicRoute, readBody } from "@/lib/server/http";
import {
  executeTokenDecision,
  verifyApprovalToken,
} from "@/lib/server/services/approval-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const decisionInputSchema = z.object({
  token: z.string().trim().min(10, "A valid approval token is required."),
  action: z.enum(["accept", "reject"], {
    message: "Action must be either accept or reject.",
  }),
  reason: z.string().trim().max(300).optional(),
});

/**
 * GET /api/faculty/decision?token=...&action=...
 *
 * Verifies an approval token for the confirmation screen.
 * Does NOT mutate state.
 */
export async function GET(request: Request) {
  bootstrap();
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const actionParam = searchParams.get("action");
  const action = actionParam === "accept" || actionParam === "reject" ? actionParam : undefined;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: { message: "No approval token provided.", code: "missing_token" } },
      { status: 400 },
    );
  }

  const result = verifyApprovalToken(token, action);

  if (!result.tokenRecord || !result.booking) {
    return NextResponse.json(
      { ok: false, error: { message: result.reason || "Invalid decision token.", code: "invalid_token" } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      valid: result.valid,
      alreadyDecided: result.alreadyDecided,
      expired: result.expired,
      reason: result.reason,
      intendedAction: result.intendedAction,
      booking: {
        id: result.booking.id,
        fullName: result.booking.fullName,
        purpose: result.booking.purpose,
        visitDate: result.booking.visitDate,
        visitTime: result.booking.visitTime,
        status: result.booking.status,
        hostName: result.booking.hostName,
        department: result.booking.department,
        numberOfVisitors: result.booking.numberOfVisitors,
        vehicleNumber: result.booking.vehicleNumber,
      },
      faculty: result.faculty
        ? {
            id: result.faculty.id,
            name: result.faculty.name,
            department: result.faculty.department,
            designation: result.faculty.designation,
          }
        : undefined,
    },
  });
}

/**
 * POST /api/faculty/decision
 *
 * Atomically executes a faculty decision (accept or reject) using a signed token.
 * Prevents double-clicks, replay attempts, and conflicting concurrent decisions.
 */
export async function POST(request: Request) {
  bootstrap();
  return publicRoute(async () => {
    const rawBody = await readBody(request);
    const parsed = decisionInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: parsed.error.issues[0]?.message || "Invalid input.",
            code: "validation_error",
          },
        },
        { status: 400 },
      );
    }

    const { token, action, reason } = parsed.data;
    const outcome = await executeTokenDecision({ token, action, reason });

    return {
      success: true,
      status: outcome.booking.status,
      message: outcome.message,
      bookingId: outcome.booking.id,
      passIssued: outcome.booking.status === "Approved",
    };
  });
}
