import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import {
  listOutpassRequests,
  submitOutpassRequest,
  type CreateOutpassInput,
} from "@/lib/server/services/outpass";
import { toApiError } from "@/lib/server/errors";
import { z } from "zod";

export const runtime = "nodejs";

const createSchema = z.object({
  purpose: z.string().min(3).max(500),
  destination: z.string().max(200).optional(),
  emergencyContact: z.string().max(100).optional(),
  departureAt: z.string().datetime({ offset: true }),
  expectedReturnAt: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const requests = listOutpassRequests({
      studentId: actor.role === "student" ? actor.refId ?? undefined : searchParams.get("studentId") ?? undefined,
      approverId: actor.role === "teacher" ? actor.refId ?? undefined : searchParams.get("approverId") ?? undefined,
      status: status ? (status.split(",") as any) : undefined,
      limit: Number(searchParams.get("limit") ?? "100"),
    });

    return NextResponse.json(requests);
  } catch (err) {
    return toApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth(req);
    const body = await req.json();
    const input = createSchema.parse(body) as CreateOutpassInput;
    const outpass = submitOutpassRequest(input, actor);
    return NextResponse.json(outpass, { status: 201 });
  } catch (err) {
    return toApiError(err);
  }
}
