import { publicRoute } from "@/lib/server/http";
import { publicDirectory } from "@/lib/server/services/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Departments, bookable hosts and campus rules — the booking form's options. */
export async function GET() {
  return publicRoute(() => publicDirectory());
}
