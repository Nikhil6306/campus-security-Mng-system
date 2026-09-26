import { redirect } from "next/navigation";

import { STATUS_PATH } from "@/lib/dsvv";

/**
 * Superseded by `/booking-status`. The query string is carried across so a
 * bookmarked or e-mailed status link still opens on the right booking.
 */
export default async function LegacyBookingStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }
  const query = params.toString();
  redirect(query ? `${STATUS_PATH}?${query}` : STATUS_PATH);
}
