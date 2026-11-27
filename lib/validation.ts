/**
 * Small, dependency-free validation helpers. Every form in the app validates
 * through these so the messages stay consistent.
 */

const CAMPUS_TZ = "Asia/Kolkata" as const;

function nowInCampusTz(): { date: string; hours: number; minutes: number } {
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
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hours = Number(parts.hour) % 24;
  const minutes = Number(parts.minute);
  return { date, hours, minutes };
}

export function todayInCampusTz(offsetDays = 0): string {
  if (offsetDays === 0) return nowInCampusTz().date;
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

export function campusMinutesNow(): number {
  const { hours, minutes } = nowInCampusTz();
  return hours * 60 + minutes;
}

export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
/** Indian format, e.g. UK07AB1234 / DL1CAB1234 — spaces and dashes tolerated. */
const VEHICLE_RE = /^[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{1,4}$/;

export const required = (value: unknown, label = "This field"): string | undefined =>
  value === undefined || value === null || `${value}`.trim() === ""
    ? `${label} is required.`
    : undefined;

export function validateName(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Full name is required.";
  if (v.length < 3) return "Please enter at least 3 characters.";
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(v))
    return "Use letters, spaces, apostrophes or hyphens only.";
  return undefined;
}

export function validateMobile(value: string): string | undefined {
  const v = value.replace(/[\s-]/g, "");
  if (!v) return "Mobile number is required.";
  if (!/^\d+$/.test(v)) return "Mobile number must contain digits only.";
  if (!MOBILE_RE.test(v)) return "Enter a valid 10-digit mobile number.";
  return undefined;
}

export function validateEmail(value: string, optional = false): string | undefined {
  const v = value.trim();
  if (!v) return optional ? undefined : "Email address is required.";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return undefined;
}

export function validateVehicleNumber(value: string, optional = false): string | undefined {
  const v = value.trim().toUpperCase();
  if (!v) return optional ? undefined : "Vehicle registration number is required.";
  if (!VEHICLE_RE.test(v)) return "Use a valid format, e.g. UK07AB1234.";
  return undefined;
}

/** Rejects empty and past dates using Asia/Kolkata timezone (today is allowed). */
export function validateFutureDate(value: string, label = "Date"): string | undefined {
  if (!value) return `${label} is required.`;
  const today = todayInCampusTz();
  if (value < today) return `${label} cannot be in the past.`;
  const max = todayInCampusTz(90);
  if (value > max) return `${label} cannot be more than 90 days ahead.`;
  return undefined;
}

export function validateDate(value: string, label = "Date"): string | undefined {
  if (!value) return `${label} is required.`;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Enter a valid date.";
  return undefined;
}

/** Campus gates operate between 07:00 and 20:00 for scheduled visits. */
export function validateTime(value: string, label = "Time"): string | undefined {
  if (!value) return `${label} is required.`;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return "Enter a valid time.";
  const [h] = value.split(":").map(Number);
  if (h < 7 || h >= 20) return "Visiting hours are 07:00 – 20:00.";
  return undefined;
}

/** Validates visit date against Asia/Kolkata campus timezone. */
export function validateVisitDate(value: string, label = "Visit date"): string | undefined {
  if (!value) return `${label} is required.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter a valid date.";
  const today = todayInCampusTz();
  if (value < today) return `${label} cannot be in the past.`;
  const max = todayInCampusTz(90);
  if (value > max) return `${label} cannot be more than 90 days ahead.`;
  return undefined;
}

/** Validates arrival time against visiting hours and Asia/Kolkata current clock. */
export function validateVisitTime(
  date: string,
  time: string,
  from = "09:00",
  to = "17:00",
): string | undefined {
  if (!time) return "Expected arrival time is required.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return "Enter a valid time (HH:mm).";
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m;
  const [fromH, fromM] = from.split(":").map(Number);
  const [toH, toM] = to.split(":").map(Number);
  const fromMinutes = fromH * 60 + fromM;
  const toMinutes = toH * 60 + toM;

  if (minutes < fromMinutes || minutes >= toMinutes) {
    return `Visiting hours are ${from} to ${to}.`;
  }
  const today = todayInCampusTz();
  if (date === today) {
    const nowMins = campusMinutesNow();
    if (minutes <= nowMins) {
      return "That time has already passed today.";
    }
  }
  return undefined;
}

/** Validates optional expected departure time. If provided, must be after arrival time. */
export function validateDepartureTime(
  arrivalTime: string,
  departureTime: string,
): string | undefined {
  if (!departureTime) return undefined;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime)) return "Enter a valid time (HH:mm).";
  if (!arrivalTime) return undefined;
  const [arrH, arrM] = arrivalTime.split(":").map(Number);
  const [depH, depM] = departureTime.split(":").map(Number);
  const arrMinutes = arrH * 60 + arrM;
  const depMinutes = depH * 60 + depM;
  if (depMinutes <= arrMinutes) {
    return "Expected departure time must be after expected arrival time.";
  }
  return undefined;
}

/**
 * ID numbers vary by document type, so this checks shape rather than issuing
 * authority: 4–20 characters, letters/digits/spaces/hyphens only.
 */
export function validateIdNumber(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "ID number is required.";
  if (v.length < 4) return "ID number looks too short.";
  if (v.length > 20) return "ID number looks too long.";
  if (!/^[A-Za-z0-9][A-Za-z0-9 \-/]*$/.test(v))
    return "Use letters, digits, spaces or hyphens only.";
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Official ID masking
 * ------------------------------------------------------------------ */

/** Masks an official ID reference to at most the last 4 characters for display. */
export function maskIdNumber(value: string): string {
  const clean = (value ?? "").trim();
  if (!clean) return "—";
  if (clean.length <= 4) return clean;
  return `${"X".repeat(Math.min(8, clean.length - 4))}${clean.slice(-4)}`;
}

export function validateCount(value: number, min = 1, max = 20): string | undefined {
  if (!Number.isFinite(value)) return "Enter a number.";
  if (value < min) return `Minimum is ${min}.`;
  if (value > max) return `Maximum is ${max} per booking.`;
  return undefined;
}

export function validateText(
  value: string,
  label: string,
  min = 3,
  max = 500,
): string | undefined {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  if (v.length > max) return `${label} must be under ${max} characters.`;
  return undefined;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function normaliseVehicleNumber(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}
