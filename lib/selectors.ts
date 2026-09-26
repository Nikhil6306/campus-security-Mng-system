import type {
  ActivityLog,
  AppDatabase,
  AppNotification,
  CheckLog,
  Incident,
  Meeting,
  SecurityGuard,
  Teacher,
  Vehicle,
  VisitRequest,
} from "./types";
import { ON_CAMPUS_STATUSES, isOnCampus, toMeetingStatus } from "./types";
import { todayISO } from "./utils";

/**
 * Read helpers over the snapshot the server sent.
 *
 * These are pure projections for rendering — sorting, grouping and counting.
 * They deliberately hold no rules about who may see what: that decision was
 * already made on the server, and anything absent from the snapshot is absent
 * because this role is not entitled to it.
 */

/* ------------------------------------------------------------------ *
 * Bookings
 * ------------------------------------------------------------------ */

export function getVisitRequests(db: AppDatabase): VisitRequest[] {
  return [...db.visitRequests].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getVisitRequest(db: AppDatabase, id: string): VisitRequest | undefined {
  return db.visitRequests.find((v) => v.id.toUpperCase() === id.trim().toUpperCase());
}

export function getVisitorsInside(db: AppDatabase): VisitRequest[] {
  return db.visitRequests
    .filter((v) => isOnCampus(v.status))
    .sort((a, b) => (b.checkInAt ?? "").localeCompare(a.checkInAt ?? ""));
}

export function getPendingRequests(db: AppDatabase): VisitRequest[] {
  return db.visitRequests
    .filter((v) => v.status === "Pending" || v.status === "Rescheduled")
    .sort((a, b) => `${a.visitDate}${a.visitTime}`.localeCompare(`${b.visitDate}${b.visitTime}`));
}

export function getTodayVisits(db: AppDatabase): VisitRequest[] {
  const today = todayISO();
  return db.visitRequests
    .filter((v) => v.visitDate === today)
    .sort((a, b) => a.visitTime.localeCompare(b.visitTime));
}

/** Meetings are a projection of bookings — see `lib/types.ts`. */
export function getMeetings(db: AppDatabase): Meeting[] {
  return db.visitRequests
    .filter((v) => v.status !== "Cancelled")
    .map((v) => ({
      id: `MTG-${v.id.split("-").pop()}`,
      visitRequestId: v.id,
      visitorName: v.fullName,
      visitorMobile: v.mobile,
      visitorPhotoUrl: v.photoUrl,
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

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

export interface DashboardStats {
  todayVisitors: number;
  pendingRequests: number;
  currentlyInside: number;
  todayMeetings: number;
  vehiclesInside: number;
  todayVehicles: number;
  securityAlerts: number;
  approvedToday: number;
  checkedInToday: number;
  checkedOutToday: number;
  rejectedToday: number;
  openIncidents: number;
  criticalIncidents: number;
  activeEmergencies: number;
  activeGuards: number;
  unreadNotifications: number;
  headCountInside: number;
}

export function getDashboardStats(db: AppDatabase): DashboardStats {
  const today = todayISO();
  const todayVisits = db.visitRequests.filter((v) => v.visitDate === today);
  const inside = db.visitRequests.filter((v) => isOnCampus(v.status));
  const openIncidents = db.incidents.filter(
    (i) => i.status === "Open" || i.status === "Investigating",
  );
  const activeEmergencies = db.emergencies.filter((e) => e.status !== "Resolved");
  const onDay = (iso?: string) => (iso ?? "").slice(0, 10) === today;

  return {
    todayVisitors: todayVisits.length,
    pendingRequests: db.visitRequests.filter(
      (v) => v.status === "Pending" || v.status === "Rescheduled",
    ).length,
    currentlyInside: inside.length,
    todayMeetings: todayVisits.filter((v) =>
      ["Approved", ...ON_CAMPUS_STATUSES, "Checked Out"].includes(v.status),
    ).length,
    vehiclesInside: db.vehicles.filter((v) => v.status === "Inside").length,
    todayVehicles: db.vehicles.filter((v) => onDay(v.entryTime)).length,
    securityAlerts: openIncidents.length + activeEmergencies.length,
    approvedToday: db.visitRequests.filter((v) => v.status === "Approved" && onDay(v.decidedAt))
      .length,
    checkedInToday: db.visitRequests.filter((v) => onDay(v.checkInAt)).length,
    checkedOutToday: db.visitRequests.filter((v) => onDay(v.checkOutAt)).length,
    rejectedToday: db.visitRequests.filter((v) => v.status === "Rejected" && onDay(v.decidedAt))
      .length,
    openIncidents: openIncidents.length,
    criticalIncidents: db.incidents.filter(
      (i) => i.severity === "Critical" && i.status !== "Resolved" && i.status !== "Closed",
    ).length,
    activeEmergencies: activeEmergencies.length,
    activeGuards: db.guards.filter((g) => g.status === "On Duty" || g.status === "Active").length,
    unreadNotifications: db.notifications.filter((n) => !n.read).length,
    headCountInside: inside.reduce((sum, v) => sum + (v.numberOfVisitors || 1), 0),
  };
}

/* ------------------------------------------------------------------ *
 * Live activity
 * ------------------------------------------------------------------ */

export interface FeedEntry {
  id: string;
  at: string;
  title: string;
  detail: string;
  kind: "checkin" | "checkout" | "booking" | "incident" | "emergency" | "vehicle" | "meeting" | "system";
}

const FEED_KINDS: Record<string, FeedEntry["kind"]> = {
  "gate.check_in": "checkin",
  "gate.check_out": "checkout",
  "booking.created": "booking",
  "booking.approved": "booking",
  "booking.rejected": "booking",
  "booking.rescheduled": "booking",
  "booking.cancelled": "booking",
  "booking.no_show": "booking",
  "incident.created": "incident",
  "incident.updated": "incident",
  "incident.resolved": "incident",
  "emergency.triggered": "emergency",
  "emergency.acknowledged": "emergency",
  "emergency.resolved": "emergency",
  "vehicle.entry": "vehicle",
  "vehicle.exit": "vehicle",
  "vehicle.re_entry": "vehicle",
  "meeting.started": "meeting",
  "meeting.completed": "meeting",
};

/** The campus activity feed, newest first. */
export function getActivityFeed(db: AppDatabase, limit = 25): FeedEntry[] {
  return [...db.activity]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map((log) => ({
      id: log.id,
      at: log.at,
      title: titleForAction(log),
      detail: log.summary,
      kind: FEED_KINDS[log.action] ?? "system",
    }));
}

function titleForAction(log: ActivityLog): string {
  switch (log.action) {
    case "gate.check_in":
      return "Visitor checked in";
    case "gate.check_out":
      return "Visitor checked out";
    case "booking.created":
      return "New visitor booking received";
    case "booking.approved":
      return "Visitor meeting approved";
    case "booking.rejected":
      return "Visit request rejected";
    case "booking.rescheduled":
      return "Meeting rescheduled";
    case "booking.cancelled":
      return "Booking cancelled";
    case "booking.no_show":
      return "Visitor recorded as no-show";
    case "incident.created":
      return "Security incident reported";
    case "incident.resolved":
      return "Incident resolved";
    case "emergency.triggered":
      return "Emergency alert raised";
    case "emergency.resolved":
      return "Emergency resolved";
    case "vehicle.entry":
      return "Vehicle entered campus";
    case "vehicle.exit":
      return "Vehicle left campus";
    case "meeting.started":
      return "Meeting started";
    case "meeting.completed":
      return "Meeting completed";
    case "auth.login":
      return "Staff signed in";
    default:
      return log.action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/* ------------------------------------------------------------------ *
 * Collections
 * ------------------------------------------------------------------ */

export function getNotifications(db: AppDatabase): AppNotification[] {
  return [...db.notifications].sort((a, b) => b.at.localeCompare(a.at));
}

export function getIncidents(db: AppDatabase): Incident[] {
  return [...db.incidents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getVehicles(db: AppDatabase): Vehicle[] {
  return [...db.vehicles].sort((a, b) => b.entryTime.localeCompare(a.entryTime));
}

export function getGates(db: AppDatabase): string[] {
  const fromLocations = db.locations.filter((l) => l.kind === "Gate" && l.active).map((l) => l.name);
  return fromLocations.length ? fromLocations : ["Main Gate"];
}

export function getLocationNames(db: AppDatabase): string[] {
  return db.locations.filter((l) => l.active).map((l) => l.name);
}

export function getTeacher(db: AppDatabase, id: string | null): Teacher | undefined {
  return id ? db.teachers.find((t) => t.id === id) : undefined;
}

export function getGuard(db: AppDatabase, id: string | null | undefined): SecurityGuard | undefined {
  return id ? db.guards.find((g) => g.id === id) : undefined;
}

/** Gate log entries for one booking, oldest first — powers the visit timeline. */
export function getCheckLogs(db: AppDatabase, bookingId: string): CheckLog[] {
  return db.checkLogs
    .filter((log) => log.visitRequestId === bookingId)
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Audit entries about one record, newest first. */
export function getEntityActivity(db: AppDatabase, entityId: string): ActivityLog[] {
  return db.activity
    .filter((log) => log.entityId === entityId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

/* ------------------------------------------------------------------ *
 * Visit timeline
 * ------------------------------------------------------------------ */

export interface TimelineStep {
  label: string;
  at?: string;
  by?: string;
  done: boolean;
  current: boolean;
}

/**
 * The visit as a sequence of events, built from the booking's own timestamps
 * so it never disagrees with the record.
 */
export function getVisitTimeline(booking: VisitRequest): TimelineStep[] {
  const rejected = booking.status === "Rejected";
  const cancelled = booking.status === "Cancelled";
  const closed = ["Checked Out", "No Show", "Expired"].includes(booking.status);

  const steps: TimelineStep[] = [
    {
      label: "Booking created",
      at: booking.createdAt,
      done: true,
      current: booking.status === "Pending",
    },
  ];

  if (rejected) {
    steps.push({
      label: "Request rejected",
      at: booking.decidedAt,
      by: booking.decidedBy,
      done: true,
      current: true,
    });
    return steps;
  }
  if (cancelled) {
    steps.push({ label: "Booking cancelled", at: booking.decidedAt, done: true, current: true });
    return steps;
  }

  const approved = Boolean(booking.decidedAt) && booking.status !== "Pending";
  steps.push({
    label: "Approved · pass issued",
    at: approved ? booking.decidedAt : undefined,
    by: booking.decidedBy,
    done: approved,
    current: booking.status === "Approved",
  });

  steps.push({
    label: "Checked in at gate",
    at: booking.checkInAt,
    by: booking.checkedInBy,
    done: Boolean(booking.checkInAt),
    current: booking.status === "Checked In",
  });

  steps.push({
    label: "Meeting",
    at: booking.meetingStartedAt,
    done: Boolean(booking.meetingStartedAt),
    current: booking.status === "Meeting In Progress",
  });

  steps.push({
    label: "Checked out",
    at: booking.checkOutAt,
    by: booking.checkedOutBy,
    done: Boolean(booking.checkOutAt),
    current: closed,
  });

  return steps;
}

/* ------------------------------------------------------------------ *
 * Filtering
 * ------------------------------------------------------------------ */

/** Case-insensitive match across the fields an operator would search by. */
export function matchesQuery(booking: VisitRequest, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    booking.id,
    booking.fullName,
    booking.mobile,
    booking.hostName,
    booking.department,
    booking.organization,
    booking.vehicleNumber ?? "",
    booking.badgeNumber ?? "",
  ].some((field) => field.toLowerCase().includes(q));
}
