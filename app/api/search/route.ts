import { STAFF_ROLES, authedRoute } from "@/lib/server/http";
import { search } from "@/lib/server/services/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return authedRoute(STAFF_ROLES, (session) =>
    search(new URL(request.url).searchParams.get("q") ?? "", session),
  );
}
