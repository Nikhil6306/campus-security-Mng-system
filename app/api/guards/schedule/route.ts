import { ADMIN_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { AppError } from "@/lib/server/errors";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scheduleEntrySchema = z.object({
  guardId: z.string().min(1),
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftType: z.enum(["Morning", "Evening", "Night", "General", "Day Off"]),
  dutyStart: z.string().optional().nullable(),
  dutyEnd: z.string().optional().nullable(),
  location: z.string().default(""),
  supervisorName: z.string().default(""),
  status: z.enum(["Scheduled", "In Progress", "Completed", "Cancelled", "Day Off"]).default("Scheduled"),
  notes: z.string().optional().nullable(),
});

/**
 * GET /api/guards/schedule?guardId=GRD-001&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Admin: fetch any guard's schedule for a date range.
 */
export async function GET(request: Request) {
  return authedRoute(ADMIN_ROLES, async (session) => {
    const url = new URL(request.url);
    const guardId = url.searchParams.get("guardId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!guardId || !from || !to) {
      throw new AppError("guardId, from, and to are required.", 400, "bad_request");
    }

    if (!isSupabaseConfigured()) {
      return { schedule: [] };
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("guard_duty_schedules")
      .select("*")
      .eq("guard_id", guardId)
      .gte("schedule_date", from)
      .lte("schedule_date", to)
      .order("schedule_date");

    if (error) {
      throw new AppError("Failed to fetch schedule.", 500, "db_error");
    }

    return { schedule: data ?? [] };
  });
}

/**
 * POST /api/guards/schedule
 *
 * Admin: create or update a duty schedule entry (upsert by guard_id + schedule_date).
 */
export async function POST(request: Request) {
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const body = await readBody(request);
    const input = scheduleEntrySchema.parse(body);

    if (!isSupabaseConfigured()) {
      throw new AppError("Supabase is not configured.", 503, "not_configured");
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("guard_duty_schedules")
      .upsert(
        {
          guard_id: input.guardId,
          schedule_date: input.scheduleDate,
          shift_type: input.shiftType,
          duty_start: input.dutyStart ?? null,
          duty_end: input.dutyEnd ?? null,
          location: input.location,
          supervisor_name: input.supervisorName,
          status: input.status,
          notes: input.notes ?? null,
          created_by: session.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "guard_id,schedule_date" },
      )
      .select()
      .single();

    if (error) {
      throw new AppError("Failed to save schedule entry.", 500, "db_error");
    }

    return { entry: data };
  });
}
