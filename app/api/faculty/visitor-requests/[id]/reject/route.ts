import { NextResponse } from "next/server";

import { bootstrap, optionalSession, readBody } from "@/lib/server/http";
import { forbidden, notFound } from "@/lib/server/errors";
import { findVisit } from "@/lib/server/repo";
import { rejectBooking } from "@/lib/server/services/bookings";
import { executeTokenDecision } from "@/lib/server/services/approval-tokens";
import { isAdminRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/faculty/visitor-requests/[id]/reject
 *
 * Secure server-side rejection endpoint.
 * Authorised either by:
 *  - Signed token in request body: { token: string, reason?: string }
 *  - Authenticated faculty session (must match booking.hostId) or admin session.
 */
export async function POST(request: Request, { params }: Params) {
  bootstrap();
  const { id } = await params;
  const body = (await readBody(request).catch(() => ({}))) as Record<string, unknown>;
  const token = typeof body?.token === "string" ? body.token.trim() : null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "Declined by faculty.";

  // Case 1: Signed approval token provided
  if (token) {
    try {
      const outcome = await executeTokenDecision({
        token,
        action: "reject",
        reason,
      });
      return NextResponse.json({
        ok: true,
        data: {
          booking: outcome.booking,
          message: outcome.message,
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: { message: err.message || "Failed to reject request.", code: err.code || "reject_failed" } },
        { status: err.status || 400 },
      );
    }
  }

  // Case 2: Session-based authorisation
  const session = await optionalSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { message: "Authentication or valid decision token required.", code: "unauthorized" } },
      { status: 401 },
    );
  }

  const booking = findVisit(id);
  if (!booking) {
    throw notFound("Visit request not found.");
  }

  const admin = isAdminRole(session.role);
  const isHost = session.role === "teacher" && booking.hostId === session.refId;
  if (!admin && !isHost) {
    throw forbidden("Only the assigned faculty member or an administrator may reject this request.");
  }

  const updated = await rejectBooking(id, reason, session);
  return NextResponse.json({
    ok: true,
    data: {
      booking: updated,
      message: `Visit request ${id} rejected.`,
    },
  });
}
