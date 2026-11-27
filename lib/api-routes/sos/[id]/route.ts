import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import {
  addIncidentNote,
  dispatchGuard,
  findSosIncident,
  listIncidentEvents,
  requestBackup,
  transitionSosStatus,
  type TransitionSOSInput,
} from "@/lib/server/services/sos";
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
    const { searchParams } = new URL(req.url);

    if (searchParams.get("events") === "1") {
      return NextResponse.json(listIncidentEvents(id));
    }

    const incident = findSosIncident(id);
    if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(incident);
  } catch (err) {
    return toApiError(err);
  }
}

const transitionSchema = z.object({
  status: z.enum([
    "REPORTED", "ACKNOWLEDGED", "ASSIGNED", "RESPONDING",
    "ON_SCENE", "RESOLVED", "CLOSED", "CANCELLED", "ESCALATED",
  ]),
  note: z.string().max(1000).optional(),
  resolutionSummary: z.string().max(2000).optional(),
});

const noteSchema = z.object({
  action: z.literal("note"),
  note: z.string().min(1).max(1000),
});

const backupSchema = z.object({
  action: z.literal("backup"),
  note: z.string().min(1).max(500),
});

const dispatchSchema = z.object({
  action: z.literal("dispatch"),
  guardId: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
});

const patchSchema = z.discriminatedUnion("action", [noteSchema, backupSchema, dispatchSchema]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();

    // Check if it's a status transition or an action
    if (body.status) {
      const input = transitionSchema.parse(body) as TransitionSOSInput;
      const updated = transitionSosStatus(id, input, actor);
      return NextResponse.json(updated);
    }

    const action = patchSchema.parse(body);

    if (action.action === "note") {
      const event = addIncidentNote(id, action.note, actor);
      return NextResponse.json(event);
    }
    if (action.action === "backup") {
      const event = requestBackup(id, action.note, actor);
      return NextResponse.json(event);
    }
    if (action.action === "dispatch") {
      const updated = dispatchGuard(id, action.guardId, action.reason ?? null, actor);
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toApiError(err);
  }
}
