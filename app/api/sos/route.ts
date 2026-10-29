import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import {
  createSosIncident,
  listSosIncidents,
  type CreateSOSInput,
} from "@/lib/server/services/sos";
import { toApiError } from "@/lib/server/errors";
import { z } from "zod";

export const runtime = "nodejs";

const createSchema = z.object({
  category: z.enum([
    "Medical Emergency",
    "Fire or Smoke",
    "Security Threat",
    "Suspicious Activity",
    "Accident or Injury",
    "Other Emergency",
  ]),
  severity: z.enum(["Low", "Medium", "High", "Critical"]),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  campus: z.string().max(100).optional(),
  building: z.string().max(100).optional(),
  area: z.string().min(1).max(200),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  evidenceUrl: z.string().url().optional().nullable(),
  reporterContact: z.string().max(100).optional(),
  idempotencyKey: z.string().max(64).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const guardId = searchParams.get("guardId");

    const incidents = listSosIncidents({
      status: status ? (status.split(",") as any) : undefined,
      guardId:
        actor.role === "security" && !guardId ? actor.refId ?? undefined : guardId ?? undefined,
      limit: Number(searchParams.get("limit") ?? "100"),
    });

    return NextResponse.json(incidents);
  } catch (err) {
    return toApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth(req);

    // All authenticated roles can raise an SOS
    const body = await req.json();
    const input = createSchema.parse(body) as CreateSOSInput;

    const incident = createSosIncident(input, actor);
    return NextResponse.json(incident, { status: 201 });
  } catch (err) {
    return toApiError(err);
  }
}
