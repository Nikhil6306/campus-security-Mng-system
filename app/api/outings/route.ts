import { ALL_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { forbidden } from "@/lib/server/errors";
import { requestOuting } from "@/lib/server/services/students";
import { outingSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Students raise their own outings; staff may raise one on their behalf. */
export async function POST(request: Request) {
  return mutationRoute(ALL_ROLES, async (session) => {
    const input = parse(outingSchema, await readBody(request));
    if (session.role === "student" && session.refId !== input.studentId) {
      throw forbidden("You can only request an outing for yourself.");
    }
    return requestOuting(input, session);
  });
}
