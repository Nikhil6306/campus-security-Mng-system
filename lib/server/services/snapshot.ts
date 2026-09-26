import "server-only";

import type {
  AppDatabase,
  AuthSession,
  SecurityGuard,
  VisitRequest,
  VisitStatus,
  Visitor,
} from "@/lib/types";
import { STATUS_CODES, isAdminRole } from "@/lib/types";

/**
 * Statuses for which the visitor may still be handed their pass token.
 *
 * `Pending` and `Rescheduled` are included so the QR code exists from the
 * moment the request is submitted: scanning it then shows "awaiting approval"
 * rather than nothing. The token identifies a booking; it authorises no entry,
 * and the gate re-reads the record before it decides anything.
 */
const PASS_TOKEN_STATUSES: VisitStatus[] = [
  "Pending",
  "Rescheduled",
  "Approved",
  "Checked In",
  "Meeting In Progress",
];
import { todayISO } from "@/lib/utils";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import {
  listActivity,
  listAvailability,
  listCheckLogs,
  listDepartments,
  listEmergencies,
  listGuards,
  listIncidents,
  listLocations,
  listMovements,
  listNotifications,
  listOutings,
  listStudents,
  listTeachers,
  listVehicles,
  listVisitors,
  listVisits,
  readSettings,
} from "../repo";
import { expireStaleBookings } from "./bookings";

/**
 * Role-scoped read model.
 *
 * This is the authorisation boundary for reads. Rather than shipping the whole
 * database and letting the interface hide things, each role gets a snapshot
 * built from only the rows and columns it is entitled to — a teacher's payload
 * genuinely does not contain other teachers' visitors, and a guard's does not
 * contain home addresses. Hiding a button is a convenience; this is the control.
 */

function emptySnapshot(): AppDatabase {
  return {
    visitors: [],
    visitRequests: [],
    departments: [],
    teachers: [],
    availability: [],
    guards: [],
    students: [],
    outings: [],
    movements: [],
    checkLogs: [],
    vehicles: [],
    incidents: [],
    emergencies: [],
    notifications: [],
    activity: [],
    locations: [],
    settings: DEFAULT_SETTINGS,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Fields a gate operator has no operational need for.
 *
 * A guard verifies identity and reaches a next-of-kin in an emergency, so name,
 * photo, ID and emergency contact stay. A visitor's home address does not help
 * anyone through a gate, so it never reaches the gate console.
 */
function forGate(visitor: Visitor): Visitor {
  return { ...visitor, address: "" };
}

function bookingForGate(booking: VisitRequest): VisitRequest {
  return { ...booking, address: "" };
}

/** What a host may see about the people coming to meet them. */
function bookingForHost(booking: VisitRequest): VisitRequest {
  return {
    ...booking,
    idNumber: "",
    address: "",
    emergencyContact: "",
    passToken: undefined,
  };
}

/** Colleagues' contact rows are directory-level only. */
function guardForPeer(guard: SecurityGuard): SecurityGuard {
  return { ...guard, address: "", emergencyContact: "", email: "" };
}

/* ------------------------------------------------------------------ *
 * Builder
 * ------------------------------------------------------------------ */

export function buildSnapshot(session: AuthSession | null): AppDatabase {
  const snapshot = emptySnapshot();
  if (!session) return snapshot;

  // Opportunistic housekeeping: yesterday's unattended bookings age out before
  // anyone reads a dashboard that would otherwise count them as pending.
  expireStaleBookings();

  const settings = readSettings();
  const departments = listDepartments();
  const locations = listLocations();

  snapshot.settings = settings;
  snapshot.departments = departments;
  snapshot.locations = locations;
  snapshot.notifications = listNotifications(session.role);

  if (isAdminRole(session.role)) {
    snapshot.visitors = listVisitors();
    snapshot.visitRequests = listVisits();
    snapshot.teachers = listTeachers();
    snapshot.availability = listAvailability();
    snapshot.guards = listGuards();
    snapshot.students = listStudents();
    snapshot.outings = listOutings();
    snapshot.movements = listMovements();
    snapshot.checkLogs = listCheckLogs();
    snapshot.vehicles = listVehicles();
    snapshot.incidents = listIncidents();
    snapshot.emergencies = listEmergencies();
    snapshot.activity = listActivity();
    return snapshot;
  }

  if (session.role === "security") {
    // The gate works a rolling window: anything still open, plus today's and
    // tomorrow's expected arrivals. Historic bookings are not a gate concern.
    const today = todayISO();
    const tomorrow = todayISO(1);
    const visits = listVisits().filter(
      (v) =>
        ["Checked In", "Meeting In Progress"].includes(v.status) ||
        v.visitDate === today ||
        v.visitDate === tomorrow,
    );
    const visitorIds = new Set(visits.map((v) => v.visitorId));

    snapshot.visitRequests = visits.map(bookingForGate);
    snapshot.visitors = listVisitors().filter((v) => visitorIds.has(v.id)).map(forGate);
    snapshot.teachers = listTeachers();
    snapshot.guards = listGuards().map((g) => (g.id === session.refId ? g : guardForPeer(g)));
    snapshot.vehicles = listVehicles();
    snapshot.incidents = listIncidents();
    snapshot.emergencies = listEmergencies();
    snapshot.checkLogs = listCheckLogs().slice(0, 100);
    snapshot.movements = listMovements();
    snapshot.students = listStudents();
    snapshot.activity = listActivity(60);
    return snapshot;
  }

  if (session.role === "teacher") {
    const hostId = session.refId ?? "__none__";
    const mine = listVisits().filter((v) => v.hostId === hostId);
    snapshot.visitRequests = mine.map(bookingForHost);
    snapshot.teachers = listTeachers().filter((t) => t.id === hostId);
    snapshot.availability = listAvailability().filter((a) => a.teacherId === hostId);
    // Only the visitors they are actually meeting, and only the contact details
    // needed to receive them.
    const visitorIds = new Set(mine.map((v) => v.visitorId));
    snapshot.visitors = listVisitors()
      .filter((v) => visitorIds.has(v.id))
      .map((v) => ({ ...v, idNumber: "", address: "", emergencyContact: "" }));
    snapshot.activity = listActivity(200).filter(
      (a) => a.entity === "booking" && mine.some((v) => v.id === a.entityId),
    );
    return snapshot;
  }

  // Students see their own hostel record and outings, and nothing else.
  const studentId = session.refId ?? "__none__";
  snapshot.students = listStudents().filter((s) => s.id === studentId);
  snapshot.outings = listOutings().filter((o) => o.studentId === studentId);
  snapshot.movements = listMovements().filter((m) => m.personId === studentId);
  snapshot.teachers = listTeachers();
  return snapshot;
}

/* ------------------------------------------------------------------ *
 * Public directory — the only data an unauthenticated caller receives
 * ------------------------------------------------------------------ */

export interface PublicHost {
  id: string;
  name: string;
  departmentId: string;
  department: string;
  designation: string;
  available: boolean;
  availabilityStatus: string;
}

export interface PublicDirectory {
  departments: { id: string; name: string }[];
  hosts: PublicHost[];
  settings: {
    campusName: string;
    campusAddress: string;
    securityDeskPhone: string;
    contactEmail: string;
    visitingHoursFrom: string;
    visitingHoursTo: string;
    maxVisitorsPerBooking: number;
    advanceBookingDays: number;
    allowedVisitorTypes: string[];
  };
}

/**
 * What the public booking form is allowed to know: who can be met, and the
 * campus rules. No email addresses, no phone numbers, no room numbers — a
 * booking form does not need staff contact details, and publishing them would
 * turn the visitor portal into a scraping target.
 */
export function publicDirectory(): PublicDirectory {
  const settings = readSettings();
  return {
    departments: listDepartments()
      .filter((d) => d.active)
      .map((d) => ({ id: d.id, name: d.name })),
    hosts: listTeachers()
      .filter((t) => t.active)
      .map((t) => ({
        id: t.id,
        name: t.name,
        departmentId: t.departmentId,
        department: t.department,
        designation: t.designation,
        available: t.available,
        availabilityStatus: t.availabilityStatus,
      })),
    settings: {
      campusName: settings.campusName,
      campusAddress: settings.campusAddress,
      securityDeskPhone: settings.securityDeskPhone,
      contactEmail: settings.contactEmail,
      visitingHoursFrom: settings.visitingHoursFrom,
      visitingHoursTo: settings.visitingHoursTo,
      maxVisitorsPerBooking: settings.maxVisitorsPerBooking,
      advanceBookingDays: settings.advanceBookingDays,
      allowedVisitorTypes: settings.allowedVisitorTypes,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Visitor self-service view
 * ------------------------------------------------------------------ */

export interface PublicBookingView {
  id: string;
  status: string;
  statusCode: string;
  fullName: string;
  visitorType: string;
  hostName: string;
  department: string;
  purpose: string;
  visitDate: string;
  visitTime: string;
  expectedDuration: string;
  numberOfVisitors: number;
  vehicleNumber?: string;
  badgeNumber?: string;
  passToken?: string;
  createdAt: string;
  decidedAt?: string;
  rejectionReason?: string;
  checkInAt?: string;
  checkOutAt?: string;
  meetingStartedAt?: string;
  gate?: string;
  campusName: string;
}

/**
 * A booking as its own visitor may see it, after proving they hold the
 * reference *and* the mobile number it was made with. ID numbers, addresses and
 * internal notes are never included — the visitor already knows them, and
 * echoing them back would make the lookup worth attacking.
 */
export function publicBookingView(booking: VisitRequest): PublicBookingView {
  const settings = readSettings();
  return {
    id: booking.id,
    status: booking.status,
    statusCode: STATUS_CODES[booking.status],
    fullName: booking.fullName,
    visitorType: booking.visitorType,
    hostName: booking.hostName,
    department: booking.department,
    purpose: booking.purpose,
    visitDate: booking.visitDate,
    visitTime: booking.visitTime,
    expectedDuration: booking.expectedDuration,
    numberOfVisitors: booking.numberOfVisitors,
    vehicleNumber: booking.vehicleNumber,
    badgeNumber: booking.badgeNumber,
    // A lookup key, not a credential. Withheld once the booking reaches a
    // closed state (rejected, cancelled, expired) so a stale QR stops
    // resolving to anything at all.
    passToken: PASS_TOKEN_STATUSES.includes(booking.status) ? booking.passToken : undefined,
    createdAt: booking.createdAt,
    decidedAt: booking.decidedAt,
    rejectionReason: booking.rejectionReason,
    checkInAt: booking.checkInAt,
    checkOutAt: booking.checkOutAt,
    meetingStartedAt: booking.meetingStartedAt,
    gate: booking.gate,
    campusName: settings.campusName,
  };
}
