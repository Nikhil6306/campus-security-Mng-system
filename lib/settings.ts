import type { AppSettings } from "./types";

/**
 * Campus configuration defaults.
 *
 * Settings live in the `app_settings` table and are delivered to the browser as
 * part of the role-scoped snapshot; this module only supplies the fallback used
 * before an administrator has saved anything, and the derived helpers that both
 * the server and the UI need to agree on.
 */

export const DEFAULT_SETTINGS: AppSettings = {
  campusName: "Dev Sanskriti Vishwavidyalaya",
  campusAddress: "Gayatrikunj–Shantikunj, Haridwar, Uttarakhand 249411",
  contactEmail: "security@dsvv.edu.in",
  securityDeskPhone: "1800-000-000",
  visitingHoursFrom: "07:00",
  visitingHoursTo: "20:00",
  maxVisitorsPerBooking: 20,
  advanceBookingDays: 90,
  defaultMeetingMinutes: 30,
  requireIdProof: true,
  requireVehicleDetails: true,
  autoExpireHours: 24,
  allowedVisitorTypes: [
    "Prospective Student",
    "Parent/Guardian",
    "Academic Visitor",
    "Researcher",
    "Institutional Delegate",
    "Alumni",
    "Guest",
    "Vendor",
    "Official",
    "Interview Candidate",
    "Other",
  ],
  notifyRequests: true,
  notifyGate: true,
  notifyIncidents: true,
};

/** `07:00`–`20:00` as minutes past midnight, for slot filtering. */
export function visitingWindow(settings: AppSettings): { from: number; to: number } {
  return { from: toMinutes(settings.visitingHoursFrom), to: toMinutes(settings.visitingHoursTo) };
}

/**
 * When a visitor pass stops being admissible.
 *
 * The slot itself plus the campus grace window (`autoExpireHours`), so a
 * visitor who arrives late on the day is still admitted while a pass from last
 * week is not. Configurable rather than hard-coded, and never unlimited.
 */
export function passExpiryFor(
  visitDate: string,
  visitTime: string,
  graceHours: number,
): string {
  const slot = new Date(`${visitDate}T${visitTime || "00:00"}:00`);
  if (Number.isNaN(slot.getTime())) {
    // An unparseable slot must not produce a pass that never expires.
    return new Date(Date.now() + Math.max(1, graceHours) * 3_600_000).toISOString();
  }
  return new Date(slot.getTime() + Math.max(1, graceHours) * 3_600_000).toISOString();
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return 0;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${`${h}`.padStart(2, "0")}:${`${m}`.padStart(2, "0")}`;
}
