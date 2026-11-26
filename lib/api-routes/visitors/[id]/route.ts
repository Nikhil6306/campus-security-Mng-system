import { z } from "zod";

import { ADMIN_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { notFound } from "@/lib/server/errors";
import { audit } from "@/lib/server/audit";
import { run, tx, get } from "@/lib/server/db";
import { mapVisitor } from "@/lib/server/repo";
import { parse } from "@/lib/server/validation";
import type { Row } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const blacklistSchema = z.object({
  blacklisted: z.boolean(),
  reason: z.string().optional(),
});

/**
 * PATCH /api/visitors/[id]
 *
 * Blacklists or un-blacklists a visitor. Admin-only.
 * The full Aadhaar number is never returned - the visitor row in the response
 * carries only the last four digits, as everywhere else in the system.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const body = (await readBody(request)) as Record<string, unknown>;
    const { blacklisted, reason } = parse(blacklistSchema, body);

    const existing = get<Row>("SELECT * FROM visitors WHERE id = ?", [id]);
    if (!existing) throw notFound("No visitor found for that ID.");

    const visitor = mapVisitor(existing);
    const now = new Date().toISOString();

    tx(() => {
      run("UPDATE visitors SET blacklisted = ?, updated_at = ? WHERE id = ?", [
        blacklisted ? 1 : 0,
        now,
        id,
      ]);

      audit(session, {
        action: blacklisted ? "visitor.blacklisted" : "visitor.unblacklisted",
        entity: "visitor",
        entityId: id,
        summary: blacklisted
          ? `${session.name} blacklisted visitor ${visitor.fullName}${reason ? ` - reason: ${reason}` : ""}.`
          : `${session.name} removed ${visitor.fullName} from the watchlist.`,
      });
    });

    const updated = get<Row>("SELECT * FROM visitors WHERE id = ?", [id]);
    if (!updated) throw notFound("Visitor disappeared during update.");
    return mapVisitor(updated);
  });
}