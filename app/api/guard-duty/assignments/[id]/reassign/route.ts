import { NextRequest } from "next/server";
import { ADMIN_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { reassignGuardAssignment } from "@/lib/server/services/guard-duty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const body = (await readBody(request)) as {
      newGuardId: string;
      newGuardName: string;
      reason: string;
    };

    return reassignGuardAssignment(
      id,
      body.newGuardId,
      body.reason,
      session,
    );
  });
}
