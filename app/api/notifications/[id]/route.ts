import { STAFF_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { markRead, removeNotification } from "@/lib/server/services/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(STAFF_ROLES, async (session) => {
    const body = (await readBody(request)) as { read?: boolean };
    markRead(id, body.read !== false, session);
    return { id };
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(STAFF_ROLES, () => {
    removeNotification(id);
    return { id };
  });
}
