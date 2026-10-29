import { publicRoute } from "@/lib/server/http";
import { getPublicMonthlyVisitorStats } from "@/lib/server/services/visitor-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return publicRoute(async () => {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    return getPublicMonthlyVisitorStats(isNaN(year as number) ? undefined : year);
  });
}
