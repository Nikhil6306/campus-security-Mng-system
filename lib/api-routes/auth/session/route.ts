import { publicRoute, optionalSession } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who am I? Returns null when signed out — never an error. */
export async function GET() {
  return publicRoute(async () => optionalSession());
}
