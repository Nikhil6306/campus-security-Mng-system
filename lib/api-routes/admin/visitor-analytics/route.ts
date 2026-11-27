import { ADMIN_ROLES, authedRoute } from "@/lib/server/http";
import { getAdminVisitorAnalytics } from "@/lib/server/services/visitor-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return authedRoute(ADMIN_ROLES, async () => {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    return getAdminVisitorAnalytics(isNaN(year as number) ? undefined : year);
  });
}
