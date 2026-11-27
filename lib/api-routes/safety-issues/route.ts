import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import {
  createSafetyIssue,
  listSafetyIssues,
  type CreateSafetyIssueInput,
} from "@/lib/server/services/safety-issues";
import { toApiError } from "@/lib/server/errors";
import { z } from "zod";

export const runtime = "nodejs";

const createSchema = z.object({
  category: z.enum([
    "Broken Gate/Door Lock",
    "Damaged CCTV",
    "Faulty Security Light",
    "Blocked Fire Exit",
    "Missing/Damaged Fire Extinguisher",
    "Unsafe Electrical Condition",
    "Damaged Boundary/Access Barrier",
    "Other Campus Safety Issue",
  ]),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  campus: z.string().max(100).optional(),
  building: z.string().max(100).optional(),
  area: z.string().min(1).max(200),
  severity: z.enum(["Low", "Medium", "High", "Critical"]),
  urgency: z.enum(["Routine", "Normal", "Urgent", "Immediate"]).optional(),
  evidenceUrl: z.string().url().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");

    const issues = listSafetyIssues({
      status: status ? (status.split(",") as any) : undefined,
      severity: severity as any,
      reporterId: actor.role === "security" ? actor.userId : undefined,
      limit: Number(searchParams.get("limit") ?? "100"),
    });

    return NextResponse.json(issues);
  } catch (err) {
    return toApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth(req);
    const body = await req.json();
    const input = createSchema.parse(body) as CreateSafetyIssueInput;
    const issue = createSafetyIssue(input, actor);
    return NextResponse.json(issue, { status: 201 });
  } catch (err) {
    return toApiError(err);
  }
}
