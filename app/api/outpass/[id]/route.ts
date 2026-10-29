import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import {
  approveOutpass,
  findOutpass,
  findPassByOutpass,
  rejectOutpass,
} from "@/lib/server/services/outpass";
import { toApiError } from "@/lib/server/errors";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAuth(req);
    const { id } = await params;

    const outpass = findOutpass(id);
    if (!outpass) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Students can only see their own
    if (actor.role === "student" && outpass.studentId !== actor.refId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Teachers can only see their assigned outpasses
    if (actor.role === "teacher" && outpass.approverId !== actor.refId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Include pass info if approved
    const pass = outpass.status === "APPROVED" ? findPassByOutpass(id) : null;
    return NextResponse.json({ ...outpass, pass });
  } catch (err) {
    return toApiError(err);
  }
}

const decisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().min(1).max(500) }),
  z.object({ action: z.literal("cancel") }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const decision = decisionSchema.parse(body);

    if (decision.action === "approve") {
      const result = approveOutpass(id, actor);
      // Return pass with token (one-time only in this response)
      return NextResponse.json(result);
    }

    if (decision.action === "reject") {
      const updated = rejectOutpass(id, decision.reason, actor);
      return NextResponse.json(updated);
    }

    // Cancel (student only, PENDING requests)
    if (decision.action === "cancel") {
      const outpass = findOutpass(id);
      if (!outpass) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (actor.role === "student" && outpass.studentId !== actor.refId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (outpass.status !== "PENDING") {
        return NextResponse.json({ error: "Only PENDING requests can be cancelled" }, { status: 409 });
      }
      const { run } = await import("@/lib/server/db");
      const now = new Date().toISOString();
      run(
        "UPDATE outpass_requests SET status = 'CANCELLED', decided_at = ?, decided_by = ?, updated_at = ? WHERE id = ?",
        [now, actor.name, now, id],
      );
      return NextResponse.json(findOutpass(id));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toApiError(err);
  }
}
