import { GATE_ROLES, ADMIN_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { AppError } from "@/lib/server/errors";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/guards/my-schedule?week=YYYY-MM-DD
 *
 * Returns the authenticated guard's duty schedule for the given week
 * (Monday–Sunday). Pass the ISO date of any day in the desired week.
 * Defaults to the current week.
 */
export async function GET(request: Request) {
  return authedRoute(GATE_ROLES, async (session) => {
    const url = new URL(request.url);
    const weekParam = url.searchParams.get("week");

    // Determine the Monday of the requested week
    const anchor = weekParam ? new Date(weekParam) : new Date();
    if (isNaN(anchor.getTime())) {
      throw new AppError("Invalid week parameter. Use YYYY-MM-DD.", 400, "bad_request");
    }

    // ISO weekday: Monday=1, Sunday=7
    const day = anchor.getDay();
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    const monday = new Date(anchor);
    monday.setDate(monday.getDate() + diff);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const from = dates[0];
    const to = dates[6];

    const refId = session.refId;
    if (!refId) {
      return { weekStart: from, weekEnd: to, schedule: [] };
    }

    if (!isSupabaseConfigured()) {
      return { weekStart: from, weekEnd: to, schedule: [] };
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("guard_duty_schedules")
      .select("*")
      .eq("guard_id", refId)
      .gte("schedule_date", from)
      .lte("schedule_date", to)
      .order("schedule_date");

    if (error) {
      throw new AppError("Failed to load schedule.", 500, "db_error");
    }

    return { weekStart: from, weekEnd: to, schedule: data ?? [] };
  });
}
