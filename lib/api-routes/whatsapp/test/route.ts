import { ADMIN_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { badRequest } from "@/lib/server/errors";
import { readSettings } from "@/lib/server/repo";
import { audit } from "@/lib/server/audit";
import { normaliseWhatsApp, sendTestMessage } from "@/lib/server/services/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Send test message" from the settings screen.
 *
 * Confirms the configured provider end to end. When no credentials are set the
 * mock adapter answers, and the result says so rather than reporting success.
 */
export async function POST(request: Request) {
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const body = (await readBody(request)) as { countryCode?: string; number?: string };
    const to = normaliseWhatsApp(body.countryCode ?? "+91", body.number ?? "");
    if (!to) {
      throw badRequest("Enter a valid WhatsApp number to test.", {
        number: "Enter a valid number, e.g. 9876543210.",
      });
    }

    const settings = readSettings();
    const result = await sendTestMessage(to, session, settings.campusName);

    audit(session, {
      action: "whatsapp.test",
      entity: "whatsapp",
      entityId: to,
      summary: `${session.name} sent a WhatsApp test message${
        result.simulated ? " (simulated — no provider configured)" : ""
      }.`,
    });

    return result;
  });
}
