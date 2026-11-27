import { ADMIN_ROLES, STAFF_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { readSettings, saveSettings } from "@/lib/server/services/settings";
import { parse, settingsSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authedRoute(STAFF_ROLES, () => readSettings());
}

export async function PUT(request: Request) {
  return mutationRoute(ADMIN_ROLES, async (session) =>
    saveSettings(parse(settingsSchema, await readBody(request)), session),
  );
}
