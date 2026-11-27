import { ADMIN_ROLES, authedRoute } from "@/lib/server/http";
import { dashboardAnalytics } from "@/lib/server/services/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return authedRoute(ADMIN_ROLES, () => {
    const days = Number(new URL(request.url).searchParams.get("days") ?? 14);
    return dashboardAnalytics(Number.isFinite(days) ? Math.min(Math.max(days, 1), 90) : 14);
  });
}
