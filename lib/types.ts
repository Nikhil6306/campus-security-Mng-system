/**
 * Domain model for the Campus Security Management System.
 *
 * These types are the contract between the UI and the data layer. Records are
 * owned by the server (SQL, see `lib/server/`) and reach the browser only as a
 * role-scoped snapshot — the client never writes to storage directly.
 */

/* ------------------------------------------------------------------ *
 * Booking lifecycle
 * ------------------------------------------------------------------ */

export type VisitStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Rescheduled"
  | "Cancelled"
  | "Checked In"
  | "Meeting In Progress"
  | "Checked Out"
  | "No Show"
  | "Expired";

export const VISIT_STATUSES: VisitStatus[] = [
  "Pending",
  "Approved",
  "Rejected",
  "Rescheduled",
  "Cancelled",
  "Checked In",
  "Meeting In Progress",
  "Checked Out",
  "No Show",
  "Expired",
];

/**
 * Stable machine codes for the same lifecycle. The database stores the display
 * form (one vocabulary end to end); these codes are what APIs, exports and
 * visitor passes quote, so integrations never depend on display wording.
 */
export const STATUS_CODES: Record<VisitStatus, string> = {
  Pending: "PENDING",
  Approved: "APPROVED",
  Rejected: "REJECTED",
  Rescheduled: "RESCHEDULED",
  Cancelled: "CANCELLED",
  "Checked In": "INSIDE_CAMPUS",
  "Meeting In Progress": "MEETING_IN_PROGRESS",
  "Checked Out": "CHECKED_OUT",
  "No Show": "NO_SHOW",
  Expired: "EXPIRED",
};

/**
 * Booking reference format, e.g. `DSVV-VIS-2026-000124`.
 *
 * Kept beside the statuses because every surface that accepts a reference — the
 * visitor status page, the pass lookup, the gate console — validates against
 * the same shape. The server allocates them; these are only for input hints.
 */
export const BOOKING_REF_PATTERN = /^DSVV-VIS-\d{4}-\d{6}$/i;
export const BOOKING_REF_HINT = "DSVV-VIS-2026-000124";

/** Statuses that mean the visitor is physically on campus right now. */
export const ON_CAMPUS_STATUSES: VisitStatus[] = ["Checked In", "Meeting In Progress"];

export function isOnCampus(status: VisitStatus): boolean {
  return ON_CAMPUS_STATUSES.includes(status);
}

/** Statuses a gate operator may still act on. */
export const OPEN_STATUSES: VisitStatus[] = [
  "Pending",
  "Approved",
  "Rescheduled",
  "Checked In",
  "Meeting In Progress",
];

export type VisitorType =
  | "Prospective Student"
  | "Parent/Guardian"
  | "Academic Visitor"
  | "Researcher"
  | "Institutional Delegate"
  | "Alumni"
  | "Guest"
  | "Vendor"
  | "Official"
  | "Interview Candidate"
  | "Other";

export const VISITOR_TYPES: VisitorType[] = [
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
];

/**
 * The subset offered on the public visitor portal.
 *
 * `Vendor`, `Official` and `Interview Candidate` remain valid for bookings
 * raised at the desk and for records already in the database, but they are not
 * the vocabulary a campus visitor recognises, so the portal does not show them.
 */
export const PUBLIC_VISITOR_TYPES: VisitorType[] = [
  "Prospective Student",
  "Parent/Guardian",
  "Academic Visitor",
  "Researcher",
  "Institutional Delegate",
  "Alumni",
  "Guest",
  "Other",
];

export type VisitPurpose =
  | "Campus Visit"
  | "Teacher Meeting"
  | "Student Meeting"
  | "Parent Visit"
  | "Admission Inquiry"
  | "Administrative Work"
  | "Official Work"
  | "Event"
  | "Delivery"
  | "Other";

export const VISIT_PURPOSES: VisitPurpose[] = [
  "Campus Visit",
  "Teacher Meeting",
  "Student Meeting",
  "Parent Visit",
  "Admission Inquiry",
  "Administrative Work",
  "Official Work",
  "Event",
  "Delivery",
  "Other",
];

/** Purposes offered on the public visitor portal. */
export const PUBLIC_VISIT_PURPOSES: VisitPurpose[] = [
  "Campus Visit",
  "Admission Inquiry",
  "Teacher Meeting",
  "Student Meeting",
  "Parent Visit",
  "Administrative Work",
  "Official Work",
  "Event",
  "Other",
];

/** Purposes where a specific host must be chosen before the slot step. */
export const HOST_REQUIRED_PURPOSES: VisitPurpose[] = [
  "Teacher Meeting",
  "Student Meeting",
  "Parent Visit",
  "Admission Inquiry",
];

export type Gender = "Male" | "Female" | "Other" | "Prefer not to say";

export const GENDERS: Gender[] = ["Male", "Female", "Other", "Prefer not to say"];

/** Government photo ID presented at the gate. */
export const ID_PROOF_TYPES = [
  "Aadhaar Card",
  "PAN Card",
  "Driving Licence",
  "Voter ID",
  "Passport",
  "Employee ID",
  "Student ID",
  "Other",
] as const;

export type IdProofType = (typeof ID_PROOF_TYPES)[number];

export const DURATIONS = [
  "30 minutes",
  "1 hour",
  "2 hours",
  "Half day",
  "Full day",
] as const;

export type ExpectedDuration = (typeof DURATIONS)[number];

/* ------------------------------------------------------------------ *
 * People and organisation
 * ------------------------------------------------------------------ */

export interface Department {
  id: string; // DEPT-001
  name: string;
  code: string;
  head: string;
  location: string;
  phone: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A person who has visited or requested to visit the campus. */
export interface Visitor {
  id: string; // VSTR-0001
  fullName: string;
  mobile: string;
  email: string;
  gender: Gender;
  idType: IdProofType;
  idNumber: string;
  photoUrl?: string;
  organization: string;
  address: string;
  emergencyContact: string;
  visitorType: VisitorType;
  totalVisits: number;
  blacklisted: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ *
 * Accompanying visitors
 * ------------------------------------------------------------------ */

export const GUEST_RELATIONS = [
  "Spouse",
  "Parent",
  "Child",
  "Sibling",
  "Relative",
  "Friend",
  "Colleague",
  "Student",
  "Driver",
  "Other",
] as const;

export type GuestRelation = (typeof GUEST_RELATIONS)[number];

/**
 * One additional person named on a booking.
 *
 * The Aadhaar number itself is never carried on this type — only the last four
 * digits, which is all any interface, export or message is allowed to show.
 * The full number lives encrypted in `visit_guests.aadhaar_ciphertext` and is
 * readable only by a server-side operator action.
 */
export interface VisitGuest {
  id: string;
  bookingId: string;
  /** 2 for the first accompanying visitor, 3 for the next, and so on. */
  position: number;
  fullName: string;
  mobile: string;
  aadhaarLast4: string;
  /** True when the deployment stored a recoverable (encrypted) number. */
  aadhaarStored: boolean;
  relation: GuestRelation | string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export type AvailabilityStatus = "Available" | "Busy" | "On Leave" | "Unavailable";

export const AVAILABILITY_STATUSES: AvailabilityStatus[] = [
  "Available",
  "Busy",
  "On Leave",
  "Unavailable",
];

export interface Teacher {
  id: string; // TCH-001
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  /**
   * WhatsApp number for visit-request notifications. Falls back to `phone`
   * when unset. Never sent to the browser for non-staff callers.
   */
  whatsappNumber: string;
  departmentId: string;
  department: string;
  designation: string;
  photoUrl?: string;
  room: string;
  availabilityStatus: AvailabilityStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Derived convenience flag: bookable right now. */
  available: boolean;
}

/**
 * A host's bookable window. `days` are ISO weekday numbers (1 = Monday).
 * `blocked` holds `yyyy-mm-dd` dates that are closed regardless of the pattern.
 */
export interface TeacherAvailability {
  teacherId: string;
  days: number[];
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  slotMinutes: number;
  blocked: string[];
  updatedAt: string;
}

export const DEFAULT_AVAILABILITY: Omit<TeacherAvailability, "teacherId" | "updatedAt"> = {
  days: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "17:00",
  slotMinutes: 30,
  blocked: [],
};

export type GuardStatus = "Active" | "On Duty" | "Off Duty" | "On Leave" | "Suspended";

export const GUARD_STATUSES: GuardStatus[] = [
  "Active",
  "On Duty",
  "Off Duty",
  "On Leave",
  "Suspended",
];

export type GuardShift = "Morning" | "Evening" | "Night" | "General";

export const GUARD_SHIFTS: GuardShift[] = ["Morning", "Evening", "Night", "General"];

export interface SecurityGuard {
  id: string; // GRD-001
  employeeId: string;
  fullName: string;
  phone: string;
  email: string;
  photoUrl?: string;
  shift: GuardShift;
  shiftStart: string; // HH:mm
  shiftEnd: string; // HH:mm
  assignedGate: string;
  status: GuardStatus;
  joiningDate: string; // yyyy-mm-dd
  emergencyContact: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

/** Per-guard counters computed from the logs — never stored denormalised. */
export interface GuardActivitySummary {
  guardId: string;
  checkIns: number;
  checkOuts: number;
  vehiclesHandled: number;
  incidentsReported: number;
  emergenciesHandled: number;
  lastActivityAt?: string;
}

export interface Student {
  id: string; // STU-2026-001
  name: string;
  rollNo: string;
  departmentId: string;
  department: string;
  year: string;
  hostel: string;
  room: string;
  guardianName: string;
  guardianPhone: string;
  onCampus: boolean;
}

/* ------------------------------------------------------------------ *
 * Bookings
 * ------------------------------------------------------------------ */

/**
 * A booking. This is the central record of the system: it carries the visit
 * details, the approval decision and the gate check-in / check-out stamps.
 */
export interface VisitRequest {
  id: string; // DSVV-VIS-2026-000124
  visitorId: string;

  // Step 1 — visitor details
  fullName: string;
  mobile: string;
  email: string;
  gender: Gender;
  organization: string;
  address: string;
  emergencyContact: string;
  visitorType: VisitorType;
  idType: IdProofType;
  idNumber: string;
  photoUrl?: string;
  /** Dialling code for the WhatsApp contact, e.g. `+91`. */
  whatsappCountryCode?: string;
  /** Local WhatsApp number. Private — masked outside admin and gate roles. */
  whatsappNumber?: string;

  // Steps 2 and 3 — purpose and host
  purpose: VisitPurpose;
  purposeDetail?: string;
  hostId: string | null;
  hostName: string;
  departmentId: string | null;
  department: string;

  // Step 4 — schedule
  visitDate: string; // yyyy-mm-dd
  visitTime: string; // HH:mm (24h)
  expectedDuration: ExpectedDuration | string;

  // Step 5 — additional information
  numberOfVisitors: number;
  vehicleRequired: boolean;
  vehicleNumber?: string;
  notes?: string;
  specialRequirements?: string;

  // Lifecycle
  status: VisitStatus;
  source: "Visitor Portal" | "Walk-in" | "Security Desk";
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  rejectionReason?: string;
  rescheduledFrom?: string;
  checkInAt?: string;
  checkedInBy?: string;
  checkOutAt?: string;
  checkedOutBy?: string;
  meetingStartedAt?: string;
  meetingEndedAt?: string;
  gate?: string;
  badgeNumber?: string;
  /** Opaque token embedded in the QR code — verified server-side. */
  passToken?: string;
  /** When the pass stops being admissible at the gate (ISO-8601 UTC). */
  passExpiresAt?: string;
}

export type MeetingStatus =
  | "Requested"
  | "Approved"
  | "Rejected"
  | "In Progress"
  | "Completed"
  | "Cancelled";

/** Maps a booking's lifecycle onto the meeting vocabulary. */
export function toMeetingStatus(status: VisitStatus): MeetingStatus {
  switch (status) {
    case "Pending":
    case "Rescheduled":
      return "Requested";
    case "Approved":
    case "Checked In":
      return "Approved";
    case "Meeting In Progress":
      return "In Progress";
    case "Checked Out":
      return "Completed";
    case "Rejected":
      return "Rejected";
    default:
      return "Cancelled";
  }
}

/**
 * Meetings are a scheduling projection of {@link VisitRequest} records so that
 * the meeting calendar, the admin approvals and the teacher portal can never
 * drift out of sync. Rescheduling writes back to the underlying request.
 */
export interface Meeting {
  id: string;
  visitRequestId: string;
  visitorName: string;
  visitorMobile: string;
  /**
   * Storage path of the visitor's photograph, carried from the booking.
   *
   * A host receives it so they can recognise the person arriving for their
   * meeting. It is a reference, not an image — reading it still requires a
   * staff session on `/api/visitor-photo/[id]`.
   */
  visitorPhotoUrl?: string;
  hostId: string | null;
  hostName: string;
  department: string;
  date: string;
  time: string;
  purpose: VisitPurpose;
  duration: string;
  notes?: string;
  /** Underlying booking status — drives the row actions. */
  status: VisitStatus;
  /** Same lifecycle expressed in meeting terms. */
  meetingStatus: MeetingStatus;
}

/* ------------------------------------------------------------------ *
 * Gate operations
 * ------------------------------------------------------------------ */

export interface CheckLog {
  id: string; // CHK-0001
  visitRequestId: string;
  visitorId: string;
  visitorName: string;
  direction: "In" | "Out";
  gate: string;
  guardId: string | null;
  guardName: string;
  at: string;
  note?: string;
}

export type OutingStatus = "Pending" | "Approved" | "Rejected" | "Completed";

export interface OutingRequest {
  id: string; // OUT-0001
  studentId: string;
  studentName: string;
  type: "Day Outing" | "Leave" | "Home Visit" | "Medical";
  reason: string;
  fromDate: string;
  toDate: string;
  guardianApproved: boolean;
  status: OutingStatus;
  createdAt: string;
  decidedBy?: string;
}

export interface MovementLog {
  id: string;
  personId: string;
  personName: string;
  personType: "Student" | "Visitor" | "Staff";
  direction: "Entry" | "Exit";
  gate: string;
  at: string;
}

export type VehicleStatus = "Inside" | "Exited";

export const VEHICLE_TYPES = [
  "Car",
  "Two Wheeler",
  "Auto/Taxi",
  "Bus",
  "Goods Vehicle",
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface Vehicle {
  id: string; // VEH-0001
  vehicleNumber: string;
  vehicleType: VehicleType;
  visitorName: string;
  driverName: string;
  purpose: string;
  gate: string;
  entryTime: string;
  exitTime?: string;
  status: VehicleStatus;
  linkedVisitId?: string;
  guardId?: string | null;
  guardName?: string;
}

/* ------------------------------------------------------------------ *
 * Safety
 * ------------------------------------------------------------------ */

export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical";

export const INCIDENT_SEVERITIES: IncidentSeverity[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

export type IncidentStatus = "Open" | "Investigating" | "Resolved" | "Closed";

export const INCIDENT_STATUSES: IncidentStatus[] = [
  "Open",
  "Investigating",
  "Resolved",
  "Closed",
];

export const INCIDENT_TYPES = [
  "Unauthorised Entry",
  "Suspicious Activity",
  "Medical Emergency",
  "Fire",
  "Vehicle Incident",
  "Lost Property",
  "Student Safety",
  "Theft",
  "Vandalism",
  "Other",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export interface Incident {
  id: string; // INC-0001
  type: IncidentType | string;
  title: string;
  location: string;
  date: string;
  time: string;
  severity: IncidentSeverity;
  description: string;
  reportedBy: string;
  reportedById: string | null;
  assignedToId?: string | null;
  assignedToName?: string;
  attachmentUrl?: string;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export type EmergencyType =
  | "Security Emergency"
  | "Medical Emergency"
  | "Fire Emergency"
  | "Evacuation"
  | "Suspicious Activity";

export const EMERGENCY_TYPES: EmergencyType[] = [
  "Security Emergency",
  "Medical Emergency",
  "Fire Emergency",
  "Evacuation",
  "Suspicious Activity",
];

export type EmergencyStatus = "Active" | "Acknowledged" | "Resolved";

export interface EmergencyAlert {
  id: string; // SOS-0001
  type: EmergencyType;
  severity: IncidentSeverity;
  location: string;
  note?: string;
  triggeredBy: string;
  triggeredById: string | null;
  triggeredAt: string;
  status: EmergencyStatus;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
}

/* ------------------------------------------------------------------ *
 * Notifications and audit
 * ------------------------------------------------------------------ */

export type NotificationType =
  | "request"
  | "approval"
  | "rejection"
  | "checkin"
  | "checkout"
  | "security"
  | "incident"
  | "emergency"
  | "vehicle"
  | "meeting"
  | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  at: string;
  read: boolean;
  href?: string;
  /** Role the notification is addressed to; null means every staff role. */
  audience: Role | null;
}

export interface ActivityLog {
  id: string; // ACT-000001
  actorId: string | null;
  actorName: string;
  actorRole: Role | "system";
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  at: string;
  /** Coarse channel label (e.g. "web") — no IP or device fingerprinting. */
  channel: string;
}

/* ------------------------------------------------------------------ *
 * Identity
 * ------------------------------------------------------------------ */

export type Role = "super_admin" | "admin" | "security" | "teacher" | "student";

export const ROLES: Role[] = ["super_admin", "admin", "security", "teacher", "student"];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Administrator",
  admin: "Administrator",
  security: "Security Guard",
  teacher: "Teacher / Staff",
  student: "Student",
};

/** Landing route after sign-in, per role. */
export const ROLE_HOME: Record<Role, string> = {
  super_admin: "/admin/dashboard",
  admin: "/admin/dashboard",
  security: "/security/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student",
};

export function isAdminRole(role: Role | undefined | null): boolean {
  return role === "admin" || role === "super_admin";
}

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  role: Role;
  /** Teacher / student / guard record id this account is bound to. */
  refId?: string;
  /** Gate a security account is posted to. */
  gate?: string;
  loginAt: string;
}

/* ------------------------------------------------------------------ *
 * Campus configuration
 * ------------------------------------------------------------------ */

export interface CampusLocation {
  id: string;
  name: string;
  kind: "Gate" | "Block" | "Hostel" | "Facility";
  active: boolean;
}

export interface AppSettings {
  campusName: string;
  campusAddress: string;
  contactEmail: string;
  securityDeskPhone: string;
  visitingHoursFrom: string;
  visitingHoursTo: string;
  maxVisitorsPerBooking: number;
  advanceBookingDays: number;
  defaultMeetingMinutes: number;
  requireIdProof: boolean;
  requireVehicleDetails: boolean;
  autoExpireHours: number;
  allowedVisitorTypes: VisitorType[];
  notifyRequests: boolean;
  notifyGate: boolean;
  notifyIncidents: boolean;
  updatedAt?: string;
}

/**
 * The role-scoped snapshot the browser holds. The server decides which of these
 * collections are populated for the caller — an unauthorised collection arrives
 * empty rather than being filtered client-side.
 */
export interface AppDatabase {
  visitors: Visitor[];
  visitRequests: VisitRequest[];
  departments: Department[];
  teachers: Teacher[];
  availability: TeacherAvailability[];
  guards: SecurityGuard[];
  students: Student[];
  outings: OutingRequest[];
  movements: MovementLog[];
  checkLogs: CheckLog[];
  vehicles: Vehicle[];
  incidents: Incident[];
  emergencies: EmergencyAlert[];
  notifications: AppNotification[];
  activity: ActivityLog[];
  locations: CampusLocation[];
  settings: AppSettings;
  /** Server clock at snapshot time. */
  syncedAt: string;
}
