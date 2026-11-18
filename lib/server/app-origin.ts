import "server-only";

/** Returns the public app origin without allowing production links to point at localhost. */
export function getAppOrigin(preferred?: string): string {
  const configured =
    preferred?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const candidate =
    configured || (vercelUrl ? `https://${vercelUrl}` : undefined);

  if (!candidate) {
    if (process.env.VERCEL) {
      throw new Error("Configure NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL for Vercel.");
    }
    return "http://localhost:3000";
  }

  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The public app URL must use HTTP or HTTPS.");
  }
  if (
    process.env.VERCEL &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1")
  ) {
    throw new Error("The public app URL cannot point to localhost on Vercel.");
  }

  return url.origin;
}
