import "server-only";

import type {
  ActivityLog,
  AppNotification,
  AppSettings,
  CampusLocation,
  CheckLog,
  Department,
  EmergencyAlert,
  GuardActivitySummary,
  Incident,
  Meeting,
  MovementLog,
  OutingRequest,
  Role,
  SecurityGuard,
  Student,
  Teacher,
  TeacherAvailability,
  Vehicle,
  VisitRequest,
  VisitStatus,
  Visitor,
} from "@/lib/types";
import { DEFAULT_AVAILABILITY, toMeetingStatus } from "@/lib/types";
import type { VisitGuest } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { all, get, run, toBool, toInt, toJson, toNum, toOptText, toText } from "./db";
import type { Row } from "./db";

/**
 * Row mappers and read queries.
 *
 * This is the only module that knows column names. Services above it work in
 * domain objects, which is what keeps the PostgreSQL port to a single file.
 */

/* ------------------------------------------------------------------ *
 * Mappers
 * ------------------------------------------------------------------ */

export function mapDepartment(r: Row): Department {
  return {
    id: toText(r.id),
    name: toText(r.name),
    code: toText(r.code),
    head: toText(r.head),
    location: toText(r.location),
    phone: toText(r.phone),
    email: toText(r.email),
    active: toBool(r.active),
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
  };
}

export function mapVisitor(r: Row): Visitor {
  return {
    id: toText(r.id),
    fullName: toText(r.full_name),
    mobile: toText(r.mobile),
    email: toText(r.email),
    gender: toText(r.gender) as Visitor["gender"],
    idType: toText(r.id_type) as Visitor["idType"],
    idNumber: toText(r.id_number),
    photoUrl: toOptText(r.photo_url),
    organization: toText(r.organization),
    address: toText(r.address),
    emergencyContact: toText(r.emergency_contact),
    visitorType: toText(r.visitor_type) as Visitor["visitorType"],
    totalVisits: toNum(r.total_visits),
    blacklisted: toBool(r.blacklisted),
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
  };
}

export function mapTeacher(r: Row): Teacher {
  const status = toText(r.availability_status) as Teacher["availabilityStatus"];
  const active = toBool(r.active);
  return {
    id: toText(r.id),
    employeeId: toText(r.employee_id),
    name: toText(r.name),
    email: toText(r.email),
    phone: toText(r.phone),
    // Falls back to the desk number so an existing directory keeps working.
    whatsappNumber: toOptText(r.whatsapp_number) || toText(r.phone),
    departmentId: toText(r.department_id),
    department: toText(r.department_name),
    designation: toText(r.designation),
    photoUrl: toOptText(r.photo_url),
    room: toText(r.room),
    availabilityStatus: status,
    active,
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
    available: active && status === "Available",
  };
}

export function mapAvailability(r: Row): TeacherAvailability {
  return {
    teacherId: toText(r.teacher_id),
    days: toJson<number[]>(r.days, DEFAULT_AVAILABILITY.days),
    startTime: toText(r.start_time),
    endTime: toText(r.end_time),
    slotMinutes: toNum(r.slot_minutes, 30),
    blocked: toJson<string[]>(r.blocked, []),
    updatedAt: toText(r.updated_at),
  };
}

export function mapGuard(r: Row): SecurityGuard {
  return {
    id: toText(r.id),
    employeeId: toText(r.employee_id),
    fullName: toText(r.full_name),
    phone: toText(r.phone),
    email: toText(r.email),
    photoUrl: toOptText(r.photo_url),
    shift: toText(r.shift) as SecurityGuard["shift"],
    shiftStart: toText(r.shift_start),
    shiftEnd: toText(r.shift_end),
    assignedGate: toText(r.assigned_gate),
    status: toText(r.status) as SecurityGuard["status"],
    joiningDate: toText(r.joining_date),
    emergencyContact: toText(r.emergency_contact),
    address: toText(r.address),
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
  };
}

export function mapStudent(r: Row): Student {
  return {
    id: toText(r.id),
    name: toText(r.name),
    rollNo: toText(r.roll_no),
    departmentId: toText(r.department_id),
    department: toText(r.department_name),
    year: toText(r.year),
    hostel: toText(r.hostel),
    room: toText(r.room),
    guardianName: toText(r.guardian_name),
    guardianPhone: toText(r.guardian_phone),
    onCampus: toBool(r.on_campus),
  };
}

export function mapVisit(r: Row): VisitRequest {
  return {
    id: toText(r.id),
    visitorId: toText(r.visitor_id),
    fullName: toText(r.full_name),
    mobile: toText(r.mobile),
    email: toText(r.email),
    gender: toText(r.gender) as VisitRequest["gender"],
    organization: toText(r.organization),
    address: toText(r.address),
    emergencyContact: toText(r.emergency_contact),
    whatsappCountryCode: toText(r.whatsapp_country_code) || "+91",
    whatsappNumber: toText(r.whatsapp_number),
    visitorType: toText(r.visitor_type) as VisitRequest["visitorType"],
    idType: toText(r.id_type) as VisitRequest["idType"],
    idNumber: toText(r.id_number),
    photoUrl: toOptText(r.photo_url),
    purpose: toText(r.purpose) as VisitRequest["purpose"],
    purposeDetail: toOptText(r.purpose_detail),
    hostId: (r.host_id as string | null) ?? null,
    hostName: toText(r.host_name),
    departmentId: (r.department_id as string | null) ?? null,
    department: toText(r.department),
    visitDate: toText(r.visit_date),
    visitTime: toText(r.visit_time),
    expectedDuration: toText(r.expected_duration),
    numberOfVisitors: toNum(r.number_of_visitors, 1),
    vehicleRequired: toBool(r.vehicle_required),
    vehicleNumber: toOptText(r.vehicle_number),
    notes: toOptText(r.notes),
    specialRequirements: toOptText(r.special_requirements),
    status: toText(r.status) as VisitStatus,
    source: toText(r.source) as VisitRequest["source"],
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
    decidedAt: toOptText(r.decided_at),
    decidedBy: toOptText(r.decided_by),
    rejectionReason: toOptText(r.rejection_reason),
    rescheduledFrom: toOptText(r.rescheduled_from),
    checkInAt: toOptText(r.check_in_at),
    checkedInBy: toOptText(r.checked_in_by),
    checkOutAt: toOptText(r.check_out_at),
    checkedOutBy: toOptText(r.checked_out_by),
    meetingStartedAt: toOptText(r.meeting_started_at),
    meetingEndedAt: toOptText(r.meeting_ended_at),
    gate: toOptText(r.gate),
    badgeNumber: toOptText(r.badge_number),
    passToken: toOptText(r.pass_token),
    passExpiresAt: toOptText(r.pass_expires_at),
  };
}

export function mapCheckLog(r: Row): CheckLog {
  return {
    id: toText(r.id),
    visitRequestId: toText(r.visit_request_id),
    visitorId: toText(r.visitor_id),
    visitorName: toText(r.visitor_name),
    direction: toText(r.direction) as CheckLog["direction"],
    gate: toText(r.gate),
    guardId: (r.guard_id as string | null) ?? null,
    guardName: toText(r.guard_name),
    at: toText(r.at),
    note: toOptText(r.note),
  };
}

export function mapVehicle(r: Row): Vehicle {
  return {
    id: toText(r.id),
    vehicleNumber: toText(r.vehicle_number),
    vehicleType: toText(r.vehicle_type) as Vehicle["vehicleType"],
    visitorName: toText(r.visitor_name),
    driverName: toText(r.driver_name),
    purpose: toText(r.purpose),
    gate: toText(r.gate),
    entryTime: toText(r.entry_time),
    exitTime: toOptText(r.exit_time),
    status: toText(r.status) as Vehicle["status"],
    linkedVisitId: toOptText(r.linked_visit_id),
    guardId: (r.guard_id as string | null) ?? null,
    guardName: toText(r.guard_name),
  };
}

export function mapIncident(r: Row): Incident {
  return {
    id: toText(r.id),
    type: toText(r.type),
    title: toText(r.title),
    location: toText(r.location),
    date: toText(r.date),
    time: toText(r.time),
    severity: toText(r.severity) as Incident["severity"],
    description: toText(r.description),
    reportedBy: toText(r.reported_by),
    reportedById: (r.reported_by_id as string | null) ?? null,
    assignedToId: (r.assigned_to_id as string | null) ?? null,
    assignedToName: toOptText(r.assigned_to_name),
    attachmentUrl: toOptText(r.attachment_url),
    status: toText(r.status) as Incident["status"],
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
    resolvedAt: toOptText(r.resolved_at),
    resolutionNote: toOptText(r.resolution_note),
  };
}

export function mapEmergency(r: Row): EmergencyAlert {
  return {
    id: toText(r.id),
    type: toText(r.type) as EmergencyAlert["type"],
    severity: toText(r.severity) as EmergencyAlert["severity"],
    location: toText(r.location),
    note: toOptText(r.note),
    triggeredBy: toText(r.triggered_by),
    triggeredById: (r.triggered_by_id as string | null) ?? null,
    triggeredAt: toText(r.triggered_at),
    status: toText(r.status) as EmergencyAlert["status"],
    acknowledgedAt: toOptText(r.acknowledged_at),
    acknowledgedBy: toOptText(r.acknowledged_by),
    resolvedAt: toOptText(r.resolved_at),
  };
}

export function mapNotification(r: Row): AppNotification {
  return {
    id: toText(r.id),
    type: toText(r.type) as AppNotification["type"],
    title: toText(r.title),
    message: toText(r.message),
    at: toText(r.at),
    read: toBool(r.read),
    href: toOptText(r.href),
    audience: (r.audience as Role | null) ?? null,
  };
}

export function mapActivity(r: Row): ActivityLog {
  return {
    id: toText(r.id),
    actorId: (r.actor_id as string | null) ?? null,
    actorName: toText(r.actor_name),
    actorRole: toText(r.actor_role) as ActivityLog["actorRole"],
    action: toText(r.action),
    entity: toText(r.entity),
    entityId: toText(r.entity_id),
    summary: toText(r.summary),
    at: toText(r.at),
    channel: toText(r.channel),
  };
}

export function mapOuting(r: Row): OutingRequest {
  return {
    id: toText(r.id),
    studentId: toText(r.student_id),
    studentName: toText(r.student_name),
    type: toText(r.type) as OutingRequest["type"],
    reason: toText(r.reason),
    fromDate: toText(r.from_date),
    toDate: toText(r.to_date),
    guardianApproved: toBool(r.guardian_approved),
    status: toText(r.status) as OutingRequest["status"],
    createdAt: toText(r.created_at),
    decidedBy: toOptText(r.decided_by),
  };
}

export function mapMovement(r: Row): MovementLog {
  return {
    id: toText(r.id),
    personId: toText(r.person_id),
    personName: toText(r.person_name),
    personType: toText(r.person_type) as MovementLog["personType"],
    direction: toText(r.direction) as MovementLog["direction"],
    gate: toText(r.gate),
    at: toText(r.at),
  };
}

export function mapLocation(r: Row): CampusLocation {
  return {
    id: toText(r.id),
    name: toText(r.name),
    kind: toText(r.kind) as CampusLocation["kind"],
    active: toBool(r.active),
  };
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

const TEACHER_SELECT = `
  SELECT t.*, COALESCE(d.name, '') AS department_name
    FROM teachers t
    LEFT JOIN departments d ON d.id = t.department_id`;

const STUDENT_SELECT = `
  SELECT s.*, COALESCE(d.name, '') AS department_name
    FROM students s
    LEFT JOIN departments d ON d.id = s.department_id`;

export const listDepartments = (): Department[] =>
  all("SELECT * FROM departments ORDER BY name").map(mapDepartment);

export const listTeachers = (): Teacher[] =>
  all(`${TEACHER_SELECT} ORDER BY t.name`).map(mapTeacher);

export const findTeacher = (id: string): Teacher | undefined => {
  const row = get(`${TEACHER_SELECT} WHERE t.id = ?`, [id]);
  return row ? mapTeacher(row) : undefined;
};

export const listAvailability = (): TeacherAvailability[] =>
  all("SELECT * FROM teacher_availability").map(mapAvailability);

export function findAvailability(teacherId: string): TeacherAvailability {
  const row = get("SELECT * FROM teacher_availability WHERE teacher_id = ?", [teacherId]);
  if (row) return mapAvailability(row);
  return { teacherId, ...DEFAULT_AVAILABILITY, updatedAt: new Date().toISOString() };
}

export const listGuards = (): SecurityGuard[] =>
  all("SELECT * FROM security_guards ORDER BY full_name").map(mapGuard);

export const findGuard = (id: string): SecurityGuard | undefined => {
  const row = get("SELECT * FROM security_guards WHERE id = ?", [id]);
  return row ? mapGuard(row) : undefined;
};

export const listStudents = (): Student[] =>
  all(`${STUDENT_SELECT} ORDER BY s.name`).map(mapStudent);

export const listVisitors = (): Visitor[] =>
  all("SELECT * FROM visitors ORDER BY created_at DESC").map(mapVisitor);

export const findVisitorByMobile = (mobile: string): Visitor | undefined => {
  const row = get("SELECT * FROM visitors WHERE mobile = ?", [mobile]);
  return row ? mapVisitor(row) : undefined;
};

export const listVisits = (): VisitRequest[] =>
  all("SELECT * FROM visit_requests ORDER BY created_at DESC").map(mapVisit);

export const findVisit = (id: string): VisitRequest | undefined => {
  const row = get("SELECT * FROM visit_requests WHERE upper(id) = upper(?)", [id.trim()]);
  return row ? mapVisit(row) : undefined;
};

/* ------------------------------------------------------------------ *
 * Accompanying visitors
 * ------------------------------------------------------------------ */

/**
 * Maps a guest row for application use.
 *
 * `aadhaar_ciphertext` is read but never mapped onto the returned object — the
 * only Aadhaar fragment that leaves this function is the last four digits, so
 * no caller can accidentally serialise a full number into an API response, a
 * log line or an export.
 */
export function mapGuest(r: Row): VisitGuest {
  return {
    id: toText(r.id),
    bookingId: toText(r.booking_id),
    position: toNum(r.position),
    fullName: toText(r.full_name),
    mobile: toText(r.mobile),
    aadhaarLast4: toText(r.aadhaar_last4),
    aadhaarStored: Boolean(toOptText(r.aadhaar_ciphertext)),
    relation: toText(r.relation),
    address: toText(r.address),
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
  };
}

export const listGuests = (bookingId: string): VisitGuest[] =>
  all("SELECT * FROM visit_guests WHERE booking_id = ? ORDER BY position", [bookingId]).map(
    mapGuest,
  );

export const countGuests = (bookingId: string): number =>
  toNum(
    get<{ c: number }>("SELECT COUNT(*) AS c FROM visit_guests WHERE booking_id = ?", [bookingId])
      ?.c ?? 0,
  );

/** Resolves a prior submission replayed with the same idempotency key. */
export const findVisitByIdempotencyKey = (key: string): VisitRequest | undefined => {
  const row = get("SELECT * FROM visit_requests WHERE idempotency_key = ?", [key]);
  return row ? mapVisit(row) : undefined;
};

export const findVisitByToken = (token: string): VisitRequest | undefined => {
  const row = get("SELECT * FROM visit_requests WHERE pass_token = ?", [token]);
  return row ? mapVisit(row) : undefined;
};

export const listVisitsForHost = (hostId: string): VisitRequest[] =>
  all("SELECT * FROM visit_requests WHERE host_id = ? ORDER BY visit_date DESC, visit_time DESC", [
    hostId,
  ]).map(mapVisit);

export const listCheckLogs = (): CheckLog[] =>
  all("SELECT * FROM check_logs ORDER BY at DESC").map(mapCheckLog);

export const listVehicles = (): Vehicle[] =>
  all("SELECT * FROM vehicles ORDER BY entry_time DESC").map(mapVehicle);

export const findVehicle = (id: string): Vehicle | undefined => {
  const row = get("SELECT * FROM vehicles WHERE id = ?", [id]);
  return row ? mapVehicle(row) : undefined;
};

export const findVehicleInside = (vehicleNumber: string): Vehicle | undefined => {
  const row = get("SELECT * FROM vehicles WHERE vehicle_number = ? AND status = 'Inside'", [
    vehicleNumber,
  ]);
  return row ? mapVehicle(row) : undefined;
};

export const listIncidents = (): Incident[] =>
  all("SELECT * FROM incidents ORDER BY created_at DESC").map(mapIncident);

export const findIncident = (id: string): Incident | undefined => {
  const row = get("SELECT * FROM incidents WHERE id = ?", [id]);
  return row ? mapIncident(row) : undefined;
};

export const listEmergencies = (): EmergencyAlert[] =>
  all("SELECT * FROM emergencies ORDER BY triggered_at DESC").map(mapEmergency);

export const findEmergency = (id: string): EmergencyAlert | undefined => {
  const row = get("SELECT * FROM emergencies WHERE id = ?", [id]);
  return row ? mapEmergency(row) : undefined;
};

export const listNotifications = (audience?: Role): AppNotification[] =>
  (audience
    ? all("SELECT * FROM notifications WHERE audience IS NULL OR audience = ? ORDER BY at DESC LIMIT 200", [
        audience,
      ])
    : all("SELECT * FROM notifications ORDER BY at DESC LIMIT 200")
  ).map(mapNotification);

export const listActivity = (limit = 200): ActivityLog[] =>
  all("SELECT * FROM activity_logs ORDER BY at DESC LIMIT ?", [limit]).map(mapActivity);

export const listOutings = (): OutingRequest[] =>
  all("SELECT * FROM outings ORDER BY created_at DESC").map(mapOuting);

export const listMovements = (): MovementLog[] =>
  all("SELECT * FROM movements ORDER BY at DESC LIMIT 200").map(mapMovement);

export const listLocations = (): CampusLocation[] =>
  all("SELECT * FROM campus_locations ORDER BY kind, name").map(mapLocation);

export const listGates = (): string[] =>
  all<{ name: string }>(
    "SELECT name FROM campus_locations WHERE kind = 'Gate' AND active = 1 ORDER BY name",
  ).map((r) => r.name);

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export function readSettings(): AppSettings {
  const row = get<{ data: string; updated_at: string }>(
    "SELECT data, updated_at FROM app_settings WHERE id = 1",
  );
  if (!row) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...toJson<Partial<AppSettings>>(row.data, {}),
    updatedAt: row.updated_at,
  };
}

export function writeSettings(settings: AppSettings): AppSettings {
  const now = new Date().toISOString();
  const { updatedAt: _ignored, ...body } = settings;
  run(
    "INSERT INTO app_settings(id, data, updated_at) VALUES(1, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    [JSON.stringify(body), now],
  );
  return { ...settings, updatedAt: now };
}

/* ------------------------------------------------------------------ *
 * Derived reads
 * ------------------------------------------------------------------ */

/** Meetings are a projection of bookings — see `lib/types.ts`. */
export function listMeetings(visits: VisitRequest[]): Meeting[] {
  return visits
    .filter((v) => v.status !== "Cancelled")
    .map((v) => ({
      id: `MTG-${v.id.split("-").pop()}`,
      visitRequestId: v.id,
      visitorName: v.fullName,
      visitorMobile: v.mobile,
      hostId: v.hostId,
      hostName: v.hostName,
      department: v.department,
      date: v.visitDate,
      time: v.visitTime,
      purpose: v.purpose,
      duration: v.expectedDuration,
      notes: v.notes,
      status: v.status,
      meetingStatus: toMeetingStatus(v.status),
    }))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

/**
 * Gate and safety counters per guard, computed from the logs.
 *
 * `since` narrows to a day for the "today's activity" panels; omit it for a
 * guard's lifetime totals on the profile page.
 */
export function guardActivity(guardId: string, since?: string): GuardActivitySummary {
  const bound = since ?? "0000";
  const counts = get<{ ins: number; outs: number; last: string | null }>(
    `SELECT
        SUM(CASE WHEN direction = 'In' THEN 1 ELSE 0 END)  AS ins,
        SUM(CASE WHEN direction = 'Out' THEN 1 ELSE 0 END) AS outs,
        MAX(at) AS last
       FROM check_logs WHERE guard_id = ? AND at >= ?`,
    [guardId, bound],
  );
  const vehicles = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM vehicles WHERE guard_id = ? AND entry_time >= ?",
    [guardId, bound],
  );
  const incidents = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM incidents WHERE reported_by_id = ? AND created_at >= ?",
    [guardId, bound],
  );
  const emergencies = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM emergencies WHERE triggered_by_id = ? AND triggered_at >= ?",
    [guardId, bound],
  );

  return {
    guardId,
    checkIns: toNum(counts?.ins),
    checkOuts: toNum(counts?.outs),
    vehiclesHandled: toNum(vehicles?.c),
    incidentsReported: toNum(incidents?.c),
    emergenciesHandled: toNum(emergencies?.c),
    lastActivityAt: counts?.last ?? undefined,
  };
}

/** Bookings already holding a slot for a host on a date. */
export function bookedSlots(hostId: string, date: string): string[] {
  return all<{ visit_time: string }>(
    `SELECT visit_time FROM visit_requests
      WHERE host_id = ? AND visit_date = ?
        AND status IN ('Pending','Approved','Rescheduled','Checked In','Meeting In Progress')`,
    [hostId, date],
  ).map((r) => r.visit_time);
}

/** True when this visitor already holds a live booking for the same slot. */
export function hasDuplicateBooking(
  visitorId: string,
  date: string,
  time: string,
  hostId: string | null,
): boolean {
  const row = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM visit_requests
      WHERE visitor_id = ? AND visit_date = ? AND visit_time = ?
        AND (host_id IS ? OR ? IS NULL)
        AND status IN ('Pending','Approved','Rescheduled','Checked In','Meeting In Progress')`,
    [visitorId, date, time, hostId, hostId],
  );
  return toNum(row?.c) > 0;
}

export { toInt };
