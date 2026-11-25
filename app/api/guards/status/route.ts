import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/server/http";
import { getGuardRegistrationByEmail } from "@/lib/server/services/guards";
import { get } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    bootstrap();
    const url = new URL(request.url);
    const email = url.searchParams.get("email")?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { ok: false, error: { message: "Email query parameter is required.", code: "bad_request" } },
        { status: 400 },
      );
    }

    // Check guard_registration_requests first
    const reg = getGuardRegistrationByEmail(email);
    
    // Check if an active guard account exists in app_users
    const user = get<{ id: string; active: number; role: string; ref_id: string | null }>(
      "SELECT id, active, role, ref_id FROM app_users WHERE lower(email) = lower(?)",
      [email],
    );

    let guard = null;
    if (user?.ref_id) {
      guard = get<{ id: string; full_name: string; assigned_gate: string; status: string }>(
        "SELECT id, full_name, assigned_gate, status FROM security_guards WHERE id = ?",
        [user.ref_id],
      );
    }

    if (user && user.role === "security") {
      if (user.active === 1 && guard?.status !== "Suspended") {
        return NextResponse.json({
          ok: true,
          status: "APPROVED",
          guard: {
            name: guard?.full_name || reg?.full_name,
            gate: guard?.assigned_gate || reg?.assigned_gate,
            guardId: guard?.id || reg?.guard_id,
          },
        });
      } else {
        return NextResponse.json({
          ok: true,
          status: "SUSPENDED",
          message: "Guard account has been suspended. Please contact administrator.",
        });
      }
    }

    if (reg) {
      return NextResponse.json({
        ok: true,
        status: reg.status,
        rejectionReason: reg.rejection_reason ?? undefined,
        createdAt: reg.created_at,
        reviewedAt: reg.reviewed_at ?? undefined,
        assignedGate: reg.assigned_gate,
        designation: reg.designation,
      });
    }

    return NextResponse.json({
      ok: true,
      status: "NOT_FOUND",
      message: "No guard registration found with this email.",
    });
  } catch (err) {
    const message = (err as Error).message || "Internal server error.";
    return NextResponse.json(
      { ok: false, error: { message, code: "server_error" } },
      { status: 500 },
    );
  }
}
