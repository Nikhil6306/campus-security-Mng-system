import { GATE_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { verifyPass } from "@/lib/server/services/gate";
import { parse, verifySchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifies a scanned pass or a reference typed at the desk.
 *
 * Returns the verdict and the reasons behind it — never grants entry. Entry is
 * a separate, authorised call to `/api/gate/check-in`, which re-runs these
 * checks against the row rather than trusting anything the scanner produced.
 */
export async function POST(request: Request) {
  return mutationRoute(GATE_ROLES, async () => {
    const input = parse(verifySchema, await readBody(request));
    return verifyPass(input);
  });
}
