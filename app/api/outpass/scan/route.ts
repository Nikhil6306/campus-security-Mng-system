import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { scanStudentPass, type GateScanInput } from "@/lib/server/services/outpass";
import { toApiError } from "@/lib/server/errors";
import { z } from "zod";

export const runtime = "nodejs";

const scanSchema = z.object({
  rawToken: z.string().min(1),
  direction: z.enum(["EXIT", "ENTRY"]),
  gate: z.string().min(1).max(100),
  note: z.string().max(500).optional(),
  isOverride: z.boolean().optional(),
  overrideNote: z.string().max(500).optional(),
});

/**
 * Guard scans student QR pass at gate.
 * Returns allowed:true/false + reason + event + pass details.
 *
 * The QR code encodes: scsToken:<rawToken>
 * Guard scan page parses this prefix and sends rawToken here.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth(req);
    const body = await req.json();
    const input = scanSchema.parse(body) as GateScanInput;

    const result = scanStudentPass(input, actor);
    return NextResponse.json(result, { status: result.allowed ? 200 : 200 }); // always 200 with allowed flag
  } catch (err) {
    return toApiError(err);
  }
}
