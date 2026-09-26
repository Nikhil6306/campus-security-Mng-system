import { ADMIN_ROLES, authedRoute } from "@/lib/server/http";
import { messagesForBooking, overview, templateCatalogue } from "@/lib/server/services/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The WhatsApp delivery log.
 *
 * Administrators only: the rows carry visitor phone numbers and the full
 * message bodies sent to them.
 */
export async function GET(request: Request) {
  return authedRoute(ADMIN_ROLES, () => {
    const params = new URL(request.url).searchParams;

    const bookingId = params.get("bookingId");
    if (bookingId) return { messages: messagesForBooking(bookingId) };

    if (params.get("view") === "templates") return { templates: templateCatalogue() };

    const limit = Number(params.get("limit") ?? 50);
    return overview(Number.isFinite(limit) ? limit : 50);
  });
}
