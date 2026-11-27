import { ADMIN_ROLES, mutationRoute } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";
import { retryMessage } from "@/lib/server/services/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Re-attempts one failed message.
 *
 * The original row and its dedupe key are reused, so pressing this twice
 * cannot put a second copy in the visitor's chat.
 */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const result = await retryMessage(id);
    audit(session, {
      action: "whatsapp.retried",
      entity: "whatsapp",
      entityId: id,
      summary: `${session.name} retried WhatsApp message ${id} — ${
        result.sent ? "accepted" : "failed again"
      }.`,
    });
    return result;
  });
}
