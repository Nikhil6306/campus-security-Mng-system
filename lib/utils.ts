import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ *
 * Date / time helpers — the app stores dates as `yyyy-mm-dd` and times
 * as 24h `HH:mm`, so every display path goes through these helpers.
 * ------------------------------------------------------------------ */

/**
 * The IANA timezone for the campus (Dev Sanskriti Vishwavidyalaya, Haridwar).
 * All booking date / time comparisons MUST use this timezone so that a visitor
 * on the public portal and the server agree on what "today" and "now" mean,
 * regardless of the server's own locale or UTC offset.
 */
export const CAMPUS_TZ = "Asia/Kolkata" as const;

/**
 * Returns a `Date` whose fields (getFullYear / getMonth / getDate / getHours /
 * getMinutes) match the current campus-local clock when read via
 * `Intl.DateTimeFormat`.  The returned `Date` itself is still a UTC timestamp
 * internally, but it is only ever used to extract `yyyy-mm-dd` or `HH:mm`
 * strings via {@link toDateKey} / {@link campusMinutesNow}, never compared
 * numerically against another UTC timestamp.
 */
export function nowInCampusTz(): { date: string; hours: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  // en-CA produces yyyy-mm-dd which avoids locale-specific separators.
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  // `hour12: false` may produce "24" for midnight on some platforms — normalise.
  const hours = Number(parts.hour) % 24;
  const minutes = Number(parts.minute);
  return { date, hours, minutes };
}

/** Campus-local `yyyy-mm-dd` for today, with an optional day offset. */
export function todayInCampusTz(offsetDays = 0): string {
  if (offsetDays === 0) return nowInCampusTz().date;
  // Apply offset in UTC-day arithmetic and re-localise.
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

/** Current campus-local time expressed as minutes past midnight. */
export function campusMinutesNow(): number {
  const { hours, minutes } = nowInCampusTz();
  return hours * 60 + minutes;
}

/**
 * @deprecated Prefer {@link todayInCampusTz} for booking logic — this helper
 * uses the server's local clock, which is UTC on most deployments.
 */
export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toDateKey(d);
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateLong(value?: string): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** `14:30` -> `02:30 PM` */
export function formatTime(value?: string): string {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${`${hour}`.padStart(2, "0")}:${`${m ?? 0}`.padStart(2, "0")} ${suffix}`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatClock(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function relativeTime(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso.slice(0, 10));
}

export function durationBetween(from?: string, to?: string): string {
  if (!from) return "—";
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return "—";
  const mins = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function maskMobile(mobile: string): string {
  if (mobile.length < 4) return mobile;
  return `${"•".repeat(Math.max(0, mobile.length - 4))}${mobile.slice(-4)}`;
}

export function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
}

/** Deterministic pseudo-random helper used only for seeding demo data. */
export function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length];
}
