import { ADMIN_ROLES, authedRoute } from "@/lib/server/http";
import { listActivity } from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The audit trail. Administrators only — it names who did what. */
export async function GET(request: Request) {
  return authedRoute(ADMIN_ROLES, () => {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 200);
    return listActivity(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 200);
  });
}
