import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { checkAndEscalate } from "@/lib/server/services/sos";
import { toApiError, forbidden } from "@/lib/server/errors";

export const runtime = "nodejs";

/**
 * SOS escalation check endpoint.
 * Call from a cron-compatible scheduled invocation (e.g. Vercel Cron, external scheduler).
 *
 * Checks for incidents that have exceeded their acknowledgement deadline and
 * escalates them automatically.
 *
 * Idempotent: calling multiple times does not create duplicate escalations.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth(req);
    if (!["admin", "super_admin"].includes(actor.role)) {
      throw forbidden("Admin only.");
    }

    const result = checkAndEscalate();
    return NextResponse.json({
      success: true,
      ...result,
      at: new Date().toISOString(),
    });
  } catch (err) {
    return toApiError(err);
  }
}

/** Also support unauthenticated call with a shared secret for cron job usage. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = checkAndEscalate();
  return NextResponse.json({ success: true, ...result, at: new Date().toISOString() });
}
