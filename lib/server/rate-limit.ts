import "server-only";

/**
 * Fixed-window rate limiting for unauthenticated endpoints.
 *
 * The visitor status lookup takes a booking reference plus the mobile number it
 * was made with. Without a limit, that pair is guessable given enough attempts,
 * so the lookup and the public booking form are both capped per client.
 *
 * State is per-process and in memory, which is right for a single application
 * server. A multi-instance deployment should back this with Redis or the
 * database — the call sites would not change.
 */

interface Window {
  count: number;
  resetAt: number;
}

const globalRef = globalThis as typeof globalThis & { __csmsRate?: Map<string, Window> };

function store(): Map<string, Window> {
  if (!globalRef.__csmsRate) globalRef.__csmsRate = new Map();
  return globalRef.__csmsRate;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const map = store();
  const now = Date.now();
  const existing = map.get(key);

  if (!existing || existing.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic cleanup so the map cannot grow without bound.
    if (map.size > 5000) {
      for (const [k, v] of map) if (v.resetAt <= now) map.delete(k);
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Best-effort client identifier from proxy headers.
 *
 * Used only to spread rate-limit buckets — it is never stored, logged or
 * attached to a record, so it does not become a tracking identifier.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
