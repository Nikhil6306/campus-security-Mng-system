/**
 * Small, dependency-free validation helpers. Every form in the app validates
 * through these so the messages stay consistent.
 */

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
  if (!v) return optional ? undefined : "Vehicle number is required.";
  if (!VEHICLE_RE.test(v)) return "Use a valid format, e.g. UK07AB1234.";
  return undefined;
}

/** Rejects empty and past dates (today is allowed). */
export function validateFutureDate(value: string, label = "Date"): string | undefined {
  if (!value) return `${label} is required.`;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Enter a valid date.";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return `${label} cannot be in the past.`;
  const max = new Date();
  max.setDate(max.getDate() + 90);
  if (d > max) return `${label} cannot be more than 90 days ahead.`;
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
 * Aadhaar
 * ------------------------------------------------------------------ */

/**
 * Verhoeff checksum tables — the scheme UIDAI uses for the 12th digit.
 *
 * Checking the digit here rejects a transposed or mistyped number at the point
 * of entry. It says nothing about whether the number belongs to a real person:
 * this project is not connected to an authorised verification service, so the
 * only claim made anywhere is "well-formed", never "verified".
 */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function verhoeffValid(digits: string): boolean {
  let c = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(reversed[i])]];
  }
  return c === 0;
}

/** Digits only — the form accepts the grouped `1234 5678 9012` spelling. */
export function normaliseAadhaar(value: string): string {
  return value.replace(/[^\d]/g, "");
}

/**
 * Validates the *format* of an Aadhaar number: twelve digits, not starting
 * with 0 or 1, passing the Verhoeff check digit.
 */
export function validateAadhaar(value: string): string | undefined {
  const digits = normaliseAadhaar(value);

  // Shape problems name the shape, so the visitor knows what to count.
  if (digits.length !== 12) return "Please enter a valid 12-digit Aadhaar number.";

  // A number that is the right shape but cannot be an Aadhaar. The message is
  // deliberately identical for the leading-digit rule and the check digit:
  // spelling out which rule failed would help someone fabricate a number.
  if (/^[01]/.test(digits)) return "Please enter a valid Aadhaar number.";
  if (!verhoeffValid(digits)) return "Please enter a valid Aadhaar number.";
  return undefined;
}

/**
 * Groups digits as `XXXX XXXX XXXX` while the visitor types.
 *
 * Accepts a pasted number in either spelling — grouped or bare — because it
 * works from the digits alone. Only the first twelve digits survive, so a
 * stray keystroke cannot silently extend the number.
 */
export function formatAadhaar(value: string): string {
  const digits = normaliseAadhaar(value).slice(0, 12);
  return digits.replace(/(.{4})(?=.)/g, "$1 ").trim();
}

/** `XXXXXXXX1234` — the only form any interface is allowed to render. */
export function maskAadhaar(last4: string): string {
  const tail = (last4 ?? "").replace(/[^\d]/g, "").slice(-4);
  return tail ? `XXXXXXXX${tail}` : "XXXXXXXXXXXX";
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
