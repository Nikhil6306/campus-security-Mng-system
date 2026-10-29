import { GATE_ROLES, authedRoute } from "@/lib/server/http";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { findGuard, guardActivity } from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/guards/my-profile
 *
 * Returns the authenticated guard's own complete profile, including
 * today's activity summary.  Security role only — admins use /api/guards/[id].
 */
export async function GET() {
  return authedRoute(GATE_ROLES, async (session) => {
    const refId = session.refId;

    // A guard's profile is keyed by ref_id → security_guards.id
    if (!refId) {
      return {
        guard: null,
        today: null,
        registration: null,
        message: "No guard record is linked to this account yet. Your registration may still be pending admin approval.",
      };
    }

    const guard = findGuard(refId);
    if (!guard) {
      return {
        guard: null,
        today: null,
        registration: null,
        message: "Guard profile not found.",
      };
    }

    const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
    const today = guardActivity(refId, todayStart);
    const lifetime = guardActivity(refId);

    // Fetch supervisor info if available
    let supervisorName: string | null = null;
    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdminClient();
        const { data: guardRow } = await admin
          .from("security_guards")
          .select("supervisor_name, supervisor_id")
          .eq("id", refId)
          .single();
        supervisorName = guardRow?.supervisor_name || null;
      } catch {
        // Ignore
      }
    }

    return {
      guard: { ...guard, supervisorName },
      today,
      lifetime,
    };
  });
}
