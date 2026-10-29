import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import {
  findSafetyIssue,
  listMaintenanceEvents,
  updateSafetyIssue,
  type UpdateSafetyIssueInput,
} from "@/lib/server/services/safety-issues";
import { toApiError } from "@/lib/server/errors";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    if (searchParams.get("events") === "1") {
      return NextResponse.json(listMaintenanceEvents(id));
    }

    const issue = findSafetyIssue(id);
    if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(issue);
  } catch (err) {
    return toApiError(err);
  }
}

const updateSchema = z.object({
  status: z
    .enum(["REPORTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "FIXED", "VERIFIED", "CLOSED", "REOPENED", "ESCALATED"])
    .optional(),
  severity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  urgency: z.enum(["Routine", "Normal", "Urgent", "Immediate"]).optional(),
  assignedToId: z.string().optional().nullable(),
  assignedToName: z.string().optional().nullable(),
  fixNotes: z.string().max(2000).optional(),
  evidenceFixUrl: z.string().url().optional().nullable(),
  closureNote: z.string().max(1000).optional(),
  note: z.string().max(1000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const input = updateSchema.parse(body) as UpdateSafetyIssueInput;
    const updated = updateSafetyIssue(id, input, actor);
    return NextResponse.json(updated);
  } catch (err) {
    return toApiError(err);
  }
}
