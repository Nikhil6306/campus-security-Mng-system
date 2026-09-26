import "server-only";

import { z } from "zod";

import {
  AVAILABILITY_STATUSES,
  EMERGENCY_TYPES,
  GENDERS,
  GUARD_SHIFTS,
  GUARD_STATUSES,
  ID_PROOF_TYPES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  ROLES,
  VEHICLE_TYPES,
  GUEST_RELATIONS,
  VISITOR_TYPES,
  VISIT_PURPOSES,
} from "@/lib/types";
import { validateAadhaar } from "@/lib/validation";
import { PHOTO_MESSAGES } from "@/lib/photo";
import { AppError } from "./errors";

/**
 * Server-side request validation.
 *
 * The browser validates too (`lib/validation.ts`) for immediate feedback, but
 * nothing reaches the database on the strength of that: every route re-parses
 * its body here. Field-level messages are returned to the form so an API error
 * lands on the input that caused it.
 */

const MOBILE = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const VEHICLE = /^[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{1,4}$/;

export const zMobile = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => MOBILE.test(v), "Enter a valid 10-digit mobile number.");

export const zEmail = z
  .string()
  .trim()
  .refine((v) => EMAIL.test(v), "Enter a valid email address.");

export const zOptionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || EMAIL.test(v), "Enter a valid email address.")
  .optional()
  .default("");

export const zDate = z.string().regex(DATE, "Enter a valid date.");
export const zTime = z.string().regex(TIME, "Enter a valid time (HH:mm).");

export const zName = z
  .string()
  .trim()
  .min(3, "Please enter at least 3 characters.")
  .max(80, "That name is too long.")
  .regex(/^[A-Za-z][A-Za-z .'-]*$/, "Use letters, spaces, apostrophes or hyphens only.");

export const zVehicleNumber = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => VEHICLE.test(v), "Use a valid format, e.g. UK07AB1234.");

const zEnum = <T extends string>(values: readonly T[], message: string) =>
  z.enum(values as unknown as [T, ...T[]], { message });

/**
 * The receipt handed back by `/api/public/visitor-photo` after the bytes have
 * been sniffed and written.
 *
 * A booking names its photograph by this id and nothing else — never a path,
 * never a URL, never base64 — so nothing a caller types can influence where a
 * file is read from or written to. The shape matches the 24 random bytes the
 * photo store generates; anything else is refused before the booking is built.
 */
export const zPhotoId = z
  .string({ error: PHOTO_MESSAGES.required })
  .trim()
  .min(1, PHOTO_MESSAGES.required)
  .regex(/^[A-Za-z0-9_-]{16,64}$/, PHOTO_MESSAGES.corrupt);

/* ------------------------------------------------------------------ *
 * Bookings
 * ------------------------------------------------------------------ */

export const bookingSchema = z.object({
  fullName: zName,
  mobile: zMobile,
  email: zOptionalEmail,
  gender: zEnum(GENDERS, "Select a gender."),
  organization: z.string().trim().max(120).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  emergencyContact: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || MOBILE.test(v), "Enter a valid 10-digit contact number.")
    .optional()
    .default(""),
  whatsappCountryCode: z
    .string()
    .trim()
    .regex(/^\+?\d{1,4}$/, "Enter a valid country code, e.g. +91.")
    .transform((v) => (v.startsWith("+") ? v : `+${v}`))
    .optional()
    .default("+91"),
  whatsappNumber: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || /^\d{6,12}$/.test(v), "Enter a valid WhatsApp number.")
    .optional()
    .default(""),
  visitorType: zEnum(VISITOR_TYPES, "Select a visitor type."),
  idType: zEnum(ID_PROOF_TYPES, "Select an ID type."),
  idNumber: z
    .string()
    .trim()
    .min(4, "ID number looks too short.")
    .max(20, "ID number looks too long.")
    .regex(/^[A-Za-z0-9][A-Za-z0-9 \-/]*$/, "Use letters, digits, spaces or hyphens only."),
  /**
   * Mandatory for every booking, however it was raised.
   *
   * A visitor is admitted on the strength of the face the gate sees matching
   * the record, so a booking without a photograph is not a booking this system
   * will create — the public form, the desk and any future integration all go
   * through this schema.
   */
  photoId: zPhotoId,
  purpose: zEnum(VISIT_PURPOSES, "Select a purpose."),
  purposeDetail: z.string().trim().max(300).optional(),
  hostId: z.string().trim().nullable().optional(),
  departmentId: z.string().trim().nullable().optional(),
  visitDate: zDate,
  visitTime: zTime,
  expectedDuration: z.string().trim().min(1).default("30 minutes"),
  numberOfVisitors: z.coerce
    .number()
    .int("Enter a whole number.")
    .min(1, "At least one visitor is required."),
  vehicleRequired: z.boolean().default(false),
  vehicleNumber: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
  specialRequirements: z.string().trim().max(300).optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

/* ------------------------------------------------------------------ *
 * Accompanying visitors and the public booking form
 * ------------------------------------------------------------------ */

/**
 * One additional person on a booking.
 *
 * The Aadhaar rule is a *format* check — twelve digits with a valid Verhoeff
 * check digit. Nothing here contacts an authorised verification service, so a
 * value that passes is well-formed, never "verified".
 */
export const guestSchema = z.object({
  fullName: zName,
  mobile: zMobile,
  aadhaar: z
    .string()
    .transform((v) => v.replace(/[^\d]/g, ""))
    .superRefine((v, ctx) => {
      const problem = validateAadhaar(v);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
  relation: zEnum(GUEST_RELATIONS, "Select the relation to the primary visitor."),
  address: z
    .string()
    .trim()
    .min(8, "Please enter the house address.")
    .max(300, "Please keep the address under 300 characters."),
});

export type GuestInput = z.infer<typeof guestSchema>;

/**
 * The public pre-booking form.
 *
 * Stricter than `bookingSchema`, which also serves the desk: a visitor booking
 * themselves must give a reachable address and name everyone in the party, and
 * the guest list has to agree with the headcount. The desk keeps the looser
 * rules because staff take bookings by phone with partial details.
 */
export const publicBookingSchema = bookingSchema
  .extend({
    // The public form asks the visitor to describe the purpose, so the server
    // requires it too rather than trusting the browser to have insisted.
    purposeDetail: z
      .string()
      .trim()
      .min(10, "Please describe the purpose of your visit.")
      .max(300, "Please keep this under 300 characters."),
    address: z
      .string()
      .trim()
      .min(8, "Please enter your house address.")
      .max(300, "Please keep the address under 300 characters."),
    guests: z.array(guestSchema).max(19, "That is more visitors than one booking can carry.").default([]),
    /**
     * Client-generated replay guard. Opaque to the server — it only has to be
     * stable across retries of the same submission and unique between
     * different ones.
     */
    idempotencyKey: z
      .string()
      .trim()
      .min(8, "Invalid request.")
      .max(120, "Invalid request.")
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid request.")
      .optional(),
  })
  .superRefine((value, ctx) => {
    const expected = value.numberOfVisitors - 1;
    if (value.guests.length !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["guests"],
        message:
          expected === 0
            ? "Remove the additional visitor details, or increase the number of visitors."
            : `Enter details for all ${expected} additional visitor${expected === 1 ? "" : "s"}.`,
      });
    }

    // Two people on one booking cannot be the same person.
    const seen = new Set<string>();
    value.guests.forEach((guest, index) => {
      if (seen.has(guest.aadhaar)) {
        ctx.addIssue({
          code: "custom",
          path: ["guests", index, "aadhaar"],
          message: "This Aadhaar number is already listed on this booking.",
        });
      }
      seen.add(guest.aadhaar);
    });
  });

export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

/** Visitor-facing WhatsApp actions, authorised by reference + mobile. */
export const passDeliverySchema = z.object({
  bookingId: z.string().trim().min(4, "Enter your booking reference."),
  mobile: zMobile,
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, "Give a short reason so the visitor understands.").max(300),
});

export const rescheduleSchema = z.object({
  visitDate: zDate,
  visitTime: zTime,
  note: z.string().trim().max(300).optional(),
});

export const lookupSchema = z.object({
  bookingId: z.string().trim().min(4, "Enter your booking reference."),
  mobile: zMobile,
});

/* ------------------------------------------------------------------ *
 * Gate
 * ------------------------------------------------------------------ */

export const verifySchema = z
  .object({
    /** Raw QR payload, or a booking reference typed at the desk. */
    token: z.string().trim().optional(),
    bookingId: z.string().trim().optional(),
    mobile: z.string().trim().optional(),
  })
  .refine(
    (v) => Boolean(v.token || v.bookingId || v.mobile),
    "Scan a pass, or enter a booking reference or mobile number.",
  );

export const checkInSchema = z.object({
  bookingId: z.string().trim().min(4, "Enter a booking reference."),
  gate: z.string().trim().min(2, "Select a gate."),
  note: z.string().trim().max(200).optional(),
});

export const checkOutSchema = checkInSchema;

/* ------------------------------------------------------------------ *
 * Vehicles
 * ------------------------------------------------------------------ */

export const vehicleSchema = z.object({
  vehicleNumber: zVehicleNumber,
  vehicleType: zEnum(VEHICLE_TYPES, "Select a vehicle type."),
  visitorName: z.string().trim().max(80).optional().default(""),
  driverName: z.string().trim().max(80).optional().default(""),
  purpose: z.string().trim().max(200).optional().default(""),
  gate: z.string().trim().min(2, "Select a gate."),
  linkedVisitId: z.string().trim().optional().nullable(),
});

export const vehiclePatchSchema = vehicleSchema.partial().extend({
  action: z.enum(["update", "exit", "re-enter"]).optional(),
});

/* ------------------------------------------------------------------ *
 * Incidents and emergencies
 * ------------------------------------------------------------------ */

export const incidentSchema = z.object({
  type: z.string().trim().min(2, "Select an incident type."),
  title: z.string().trim().min(4, "Give the incident a short title.").max(120),
  location: z.string().trim().min(2, "Select a location."),
  date: zDate,
  time: zTime,
  severity: zEnum(INCIDENT_SEVERITIES, "Select a severity."),
  description: z.string().trim().min(10, "Describe what happened (at least 10 characters).").max(2000),
  attachmentUrl: z.string().trim().max(500).optional(),
});

export const incidentPatchSchema = z.object({
  status: zEnum(INCIDENT_STATUSES, "Select a status.").optional(),
  severity: zEnum(INCIDENT_SEVERITIES, "Select a severity.").optional(),
  assignedToId: z.string().trim().nullable().optional(),
  resolutionNote: z.string().trim().max(1000).optional(),
});

export const emergencySchema = z.object({
  type: zEnum(EMERGENCY_TYPES, "Select an emergency type."),
  severity: zEnum(INCIDENT_SEVERITIES, "Select a severity.").default("Critical"),
  location: z.string().trim().min(2, "Select a location."),
  note: z.string().trim().max(500).optional(),
});

export const emergencyPatchSchema = z.object({
  status: z.enum(["Active", "Acknowledged", "Resolved"], { message: "Select a status." }),
});

/* ------------------------------------------------------------------ *
 * Directory
 * ------------------------------------------------------------------ */

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Enter a department name.").max(80),
  code: z.string().trim().min(2, "Enter a short code.").max(12),
  head: z.string().trim().max(80).optional().default(""),
  location: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(20).optional().default(""),
  email: zOptionalEmail,
  active: z.boolean().default(true),
});

export const gateSchema = z.object({
  name: z.string().trim().min(2, "Enter a gate name.").max(80),
  active: z.boolean().default(true),
});

export const gateAssignSchema = z.object({
  guardId: z.string().trim().min(1, "Select a guard."),
});

export const teacherSchema = z.object({
  name: zName,
  employeeId: z.string().trim().min(2, "Enter an employee ID.").max(20),
  email: zEmail,
  phone: zMobile,
  /** Optional — the desk number is used when this is blank. */
  whatsappNumber: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit WhatsApp number.")
    .optional()
    .default(""),
  departmentId: z.string().trim().min(1, "Select a department."),
  designation: z.string().trim().min(2, "Enter a designation.").max(80),
  room: z.string().trim().max(80).optional().default(""),
  availabilityStatus: zEnum(AVAILABILITY_STATUSES, "Select an availability status.").default(
    "Available",
  ),
  active: z.boolean().default(true),
  photoUrl: z.string().trim().max(500).optional(),
});

export const availabilitySchema = z.object({
  days: z.array(z.number().int().min(1).max(7)).min(1, "Select at least one working day."),
  startTime: zTime,
  endTime: zTime,
  slotMinutes: z.coerce.number().int().min(10, "Slots must be at least 10 minutes.").max(240),
  blocked: z.array(zDate).default([]),
});

export const guardSchema = z.object({
  fullName: zName,
  employeeId: z.string().trim().min(2, "Enter an employee ID.").max(20),
  phone: zMobile,
  email: zOptionalEmail,
  shift: zEnum(GUARD_SHIFTS, "Select a shift."),
  shiftStart: zTime,
  shiftEnd: zTime,
  assignedGate: z.string().trim().min(2, "Assign a gate."),
  status: zEnum(GUARD_STATUSES, "Select a status."),
  joiningDate: zDate,
  emergencyContact: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || MOBILE.test(v), "Enter a valid 10-digit contact number.")
    .optional()
    .default(""),
  address: z.string().trim().max(300).optional().default(""),
  photoUrl: z.string().trim().max(500).optional(),
});

/* ------------------------------------------------------------------ *
 * Settings, auth, students
 * ------------------------------------------------------------------ */

export const settingsSchema = z.object({
  campusName: z.string().trim().min(2, "Enter the campus name.").max(120),
  campusAddress: z.string().trim().max(300).optional().default(""),
  contactEmail: zOptionalEmail,
  securityDeskPhone: z.string().trim().max(20).optional().default(""),
  visitingHoursFrom: zTime,
  visitingHoursTo: zTime,
  maxVisitorsPerBooking: z.coerce.number().int().min(1).max(200),
  advanceBookingDays: z.coerce.number().int().min(1).max(365),
  defaultMeetingMinutes: z.coerce.number().int().min(10).max(240),
  requireIdProof: z.boolean(),
  requireVehicleDetails: z.boolean(),
  autoExpireHours: z.coerce.number().int().min(1).max(168),
  allowedVisitorTypes: z.array(zEnum(VISITOR_TYPES, "Unknown visitor type.")).min(1),
  notifyRequests: z.boolean(),
  notifyGate: z.boolean(),
  notifyIncidents: z.boolean(),
});

export const loginSchema = z.object({
  email: z.string().trim().min(3, "Enter your email address."),
  password: z.string().min(1, "Enter your password."),
  /** Optional guard against signing into the wrong portal. */
  expectedRole: zEnum(ROLES, "Unknown role.").optional(),
});

export const outingDecisionSchema = z.object({
  status: z.enum(["Approved", "Rejected", "Completed"], { message: "Select a decision." }),
});

export const outingSchema = z.object({
  studentId: z.string().trim().min(1, "Select a student."),
  type: z.enum(["Day Outing", "Leave", "Home Visit", "Medical"], {
    message: "Select an outing type.",
  }),
  reason: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(500),
  fromDate: zDate,
  toDate: zDate,
  guardianApproved: z.boolean().default(false),
});

export const movementSchema = z.object({
  personId: z.string().trim().min(1),
  personType: z.enum(["Student", "Visitor", "Staff"]),
  direction: z.enum(["Entry", "Exit"]),
  gate: z.string().trim().min(2, "Select a gate."),
});

/* ------------------------------------------------------------------ *
 * Parsing helper
 * ------------------------------------------------------------------ */

/**
 * Parses `body` or throws an {@link AppError} carrying per-field messages.
 * The first issue becomes the headline so a toast reads sensibly on its own.
 */
export function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  const details: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    if (!details[key]) details[key] = issue.message;
  }
  const [firstKey] = Object.keys(details);
  throw new AppError(
    details[firstKey] ?? "Please check the details you entered.",
    422,
    "validation_failed",
    details,
  );
}
