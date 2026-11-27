import { ADMIN_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { decideOuting } from "@/lib/server/services/students";
import { outingDecisionSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const { status } = parse(outingDecisionSchema, await readBody(request));
    return decideOuting(id, status, session);
  });
}
