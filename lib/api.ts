"use client";

import type {
  ActivityLog,
  AppDatabase,
  AppSettings,
  AuthSession,
  CampusLocation,
  CheckLog,
  Department,
  EmergencyAlert,
  EmergencyStatus,
  GuardActivitySummary,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  OutingRequest,
  OutingStatus,
  Role,
  SecurityGuard,
  Teacher,
  TeacherAvailability,
  Vehicle,
  VisitGuest,
  VisitRequest,
} from "./types";

/**
 * Typed HTTP client.
 *
 * The browser never touches storage or business rules — it calls these, and the
 * server decides. Mutations come back with a fresh role-scoped snapshot, which
 * `DataProvider` installs, so the interface reflects what the database actually
 * holds rather than an optimistic guess.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = "error",
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when the caller simply is not signed in (or the session lapsed). */
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  state?: AppDatabase;
  error?: { message: string; code: string; details?: Record<string, string> };
}

/** Installed by DataProvider so every mutation can refresh the shared snapshot. */
let snapshotListener: ((state: AppDatabase) => void) | null = null;

export function onSnapshot(listener: ((state: AppDatabase) => void) | null): void {
  snapshotListener = listener;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    // fetch only rejects on a transport failure, so this is genuinely offline.
    throw new ApiError(
      "We could not reach the server. Check your connection and try again.",
      0,
      "network_error",
    );
  }

  let envelope: Envelope<T>;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiError(
      response.ok
        ? "The server sent a response we could not read."
        : "Something went wrong. Please try again.",
      response.status,
      "bad_response",
    );
  }

  if (!response.ok || !envelope.ok) {
    throw new ApiError(
      envelope.error?.message ?? "Something went wrong. Please try again.",
      response.status,
      envelope.error?.code ?? "error",
      envelope.error?.details,
    );
  }

  if (envelope.state && snapshotListener) snapshotListener(envelope.state);
  return envelope.data as T;
}

const body = (payload: unknown): RequestInit => ({ body: JSON.stringify(payload) });

/**
 * Posts multipart form data.
 *
 * `request` adds a JSON content type whenever there is a body, which would stop
 * the browser writing the multipart boundary. Passing `FormData` through with
 * no content type of our own lets it set the header itself.
 */
const postForm = <T>(path: string, form: FormData) =>
  request<T>(path, { method: "POST", body: form, headers: {} });

const post = <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: "POST", ...(payload === undefined ? {} : body(payload)) });
const patch = <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: "PATCH", ...(payload === undefined ? {} : body(payload)) });
const put = <T>(path: string, payload: unknown) =>
  request<T>(path, { method: "PUT", ...body(payload) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });
const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : "";
};

/* ------------------------------------------------------------------ *
 * Shapes returned by the API
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

export interface SlotOption {
  time: string;
  available: boolean;
  reason?: string;
}

/** What the photograph upload hands back. Deliberately not a URL. */
export interface VisitorPhotoReceipt {
  photoId: string;
  bytes: number;
  contentType: string;
}

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
  /** True when an idempotency key resolved to a booking already created. */
  replayed?: boolean;
}

/**
 * WhatsApp delivery state for a visitor's own pass.
 *
 * `live` is false whenever the campus has no WhatsApp credentials configured —
 * the UI must say "pending configuration" in that case rather than claiming a
 * message was delivered.
 */
export interface PassDeliveryReport {
  state: "sent" | "simulated" | "failed" | "queued" | "none";
  provider: string;
  live: boolean;
  detail: string;
  at?: string;
  to?: string;
}

export interface BookingStatusResult {
  booking: PublicBookingView;
  timeline: { direction: "In" | "Out"; gate: string; at: string }[];
}

export interface VerificationResult {
  ok: boolean;
  booking?: VisitRequest;
  issues: { code: string; message: string }[];
  nextAction?: "check-in" | "check-out";
}

export interface GateResult {
  booking: VisitRequest;
  guardName: string;
  gate: string;
}

export interface GuardRosterRow {
  guard: SecurityGuard;
  today: GuardActivitySummary;
}

export interface GuardProfile {
  guard: SecurityGuard;
  today: GuardActivitySummary;
  lifetime: GuardActivitySummary;
  recentLogs: CheckLog[];
  incidents: Incident[];
  shiftHistory: {
    date: string;
    checkIns: number;
    checkOuts: number;
    firstAt: string;
    lastAt: string;
  }[];
}

export interface GateActivity {
  gate: string;
  entriesToday: number;
  exitsToday: number;
  currentlyInside: number;
  vehiclesInside: number;
  openIncidents: number;
  lastActivityAt?: string;
}

export interface GateRosterRow {
  location: CampusLocation;
  guards: SecurityGuard[];
  activity: GateActivity;
}

export interface GateDetail extends GateRosterRow {
  recentLogs: CheckLog[];
}

export type WhatsAppStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";

export interface WhatsAppMessageRecord {
  id: string;
  bookingId?: string;
  visitorId?: string;
  phoneNumber: string;
  messageType: string;
  label: string;
  body: string;
  provider: string;
  providerMessageId?: string;
  status: WhatsAppStatus;
  attempts: number;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
  /** False when the row was produced by the development mock adapter. */
  simulated: boolean;
}

export interface WhatsAppProviderStatus {
  provider: string;
  configured: boolean;
  /** False whenever messages are only simulated. */
  live: boolean;
  supportsMedia: boolean;
  senderId?: string;
  businessAccountId?: string;
  hint?: string;
}

export interface WhatsAppOverview {
  status: WhatsAppProviderStatus;
  counts: Record<WhatsAppStatus, number>;
  recent: WhatsAppMessageRecord[];
}

export interface WhatsAppTemplate {
  type: string;
  label: string;
  preview: string;
}

export interface WhatsAppSendResult {
  sent: boolean;
  simulated: boolean;
  reason?: string;
}

export interface ReportResult {
  kind: string;
  title: string;
  description: string;
  generatedAt: string;
  filters: Record<string, string | undefined>;
  stats: { label: string; value: number }[];
  charts: { title: string; data: { label: string; value: number }[] }[];
  columns: { key: string; header: string }[];
  rows: Record<string, string | number>[];
}

export interface SearchHit {
  id: string;
  label: string;
  sublabel: string;
  group: string;
  href: string;
}

export interface StatePayload {
  session: AuthSession | null;
  state: AppDatabase;
}

export type BookingAction =
  | "approve"
  | "reject"
  | "reschedule"
  | "cancel"
  | "no-show"
  | "start-meeting"
  | "complete-meeting";

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

export const api = {
  /* Session */
  signIn: (email: string, password: string, expectedRole?: Role) =>
    post<AuthSession>("/api/auth/login", { email, password, expectedRole }),
  signOut: () => post<null>("/api/auth/logout"),
  session: () => request<AuthSession | null>("/api/auth/session"),
  state: () => request<StatePayload>("/api/state"),

  /* Public visitor journey */
  directory: () => request<PublicDirectory>("/api/public/directory"),
  slots: (hostId: string | null, date: string) =>
    request<{ date: string; hostId: string | null; slots: SlotOption[] }>(
      `/api/public/slots${query({ hostId: hostId ?? undefined, date })}`,
    ),
  /**
   * Stores the visitor's photograph and returns the id the booking will name.
   *
   * Only the id comes back — never a URL. The image is written to private
   * storage and can afterwards be read only through `/api/visitor-photo/[id]`,
   * which requires a staff session.
   */
  uploadVisitorPhoto: (file: Blob, filename = "visitor-photo.jpg") => {
    const form = new FormData();
    form.append("photo", file, filename);
    return postForm<VisitorPhotoReceipt>("/api/public/visitor-photo", form);
  },
  createPublicBooking: (payload: Record<string, unknown>) =>
    post<PublicBookingView>("/api/public/bookings", payload),
  bookingStatus: (bookingId: string, mobile: string) =>
    post<BookingStatusResult>("/api/public/status", { bookingId, mobile }),
  /** Sends (or retries) the visitor's pass to the number on their booking. */
  sendPass: (bookingId: string, mobile: string) =>
    post<{ delivery: PassDeliveryReport }>("/api/public/pass-delivery", { bookingId, mobile }),
  passDelivery: (bookingId: string, mobile: string) =>
    put<{ delivery: PassDeliveryReport }>("/api/public/pass-delivery", { bookingId, mobile }),

  /* Bookings */
  /** Accompanying visitors on one booking; Aadhaar arrives masked. */
  guestsForBooking: (id: string) => request<VisitGuest[]>(`/api/bookings/${id}/guests`),
  createBooking: (payload: Record<string, unknown>) =>
    post<VisitRequest>("/api/bookings", payload),
  booking: (id: string) => request<VisitRequest>(`/api/bookings/${encodeURIComponent(id)}`),
  bookingAction: (id: string, action: BookingAction, payload: Record<string, unknown> = {}) =>
    patch<VisitRequest>(`/api/bookings/${encodeURIComponent(id)}`, { action, ...payload }),

  /* Gate */
  verifyPass: (payload: { token?: string; bookingId?: string; mobile?: string }) =>
    post<VerificationResult>("/api/gate/verify", payload),
  checkIn: (bookingId: string, gate: string, note?: string) =>
    post<GateResult>("/api/gate/check-in", { bookingId, gate, note }),
  checkOut: (bookingId: string, gate: string, note?: string) =>
    post<GateResult>("/api/gate/check-out", { bookingId, gate, note }),

  /* Vehicles */
  createVehicle: (payload: Record<string, unknown>) => post<Vehicle>("/api/vehicles", payload),
  updateVehicle: (id: string, payload: Record<string, unknown>) =>
    patch<Vehicle>(`/api/vehicles/${id}`, payload),
  exitVehicle: (id: string) => patch<Vehicle>(`/api/vehicles/${id}`, { action: "exit" }),
  reEnterVehicle: (id: string, gate?: string) =>
    patch<Vehicle>(`/api/vehicles/${id}`, { action: "re-enter", gate }),
  deleteVehicle: (id: string) => del<{ id: string }>(`/api/vehicles/${id}`),

  /* Safety */
  reportIncident: (payload: Record<string, unknown>) => post<Incident>("/api/incidents", payload),
  updateIncident: (
    id: string,
    payload: {
      status?: IncidentStatus;
      severity?: IncidentSeverity;
      assignedToId?: string | null;
      resolutionNote?: string;
    },
  ) => patch<Incident>(`/api/incidents/${id}`, payload),
  triggerEmergency: (payload: Record<string, unknown>) =>
    post<EmergencyAlert>("/api/emergency", payload),
  updateEmergency: (id: string, status: EmergencyStatus) =>
    patch<EmergencyAlert>(`/api/emergency/${id}`, { status }),

  /* Notifications */
  markNotificationRead: (id: string, read = true) =>
    patch<{ id: string }>(`/api/notifications/${id}`, { read }),
  markAllNotificationsRead: () => patch<{ updated: number }>("/api/notifications"),
  deleteNotification: (id: string) => del<{ id: string }>(`/api/notifications/${id}`),

  /* Directory */
  createDepartment: (payload: Record<string, unknown>) =>
    post<Department>("/api/departments", payload),
  updateDepartment: (id: string, payload: Record<string, unknown>) =>
    patch<Department>(`/api/departments/${id}`, payload),
  deleteDepartment: (id: string) => del<{ id: string }>(`/api/departments/${id}`),

  createTeacher: (payload: Record<string, unknown>) => post<Teacher>("/api/teachers", payload),
  updateTeacher: (id: string, payload: Record<string, unknown>) =>
    patch<Teacher>(`/api/teachers/${id}`, payload),
  deleteTeacher: (id: string) => del<{ id: string }>(`/api/teachers/${id}`),
  availability: (id: string) => request<TeacherAvailability>(`/api/teachers/${id}/availability`),
  saveAvailability: (id: string, payload: Record<string, unknown>) =>
    put<{ availability: TeacherAvailability; stranded: string[] }>(
      `/api/teachers/${id}/availability`,
      payload,
    ),

  gates: () => request<GateRosterRow[]>("/api/gates"),
  gate: (id: string) => request<GateDetail>(`/api/gates/${id}`),
  createGate: (payload: { name: string; active: boolean }) =>
    post<CampusLocation>("/api/gates", payload),
  updateGate: (id: string, payload: { name: string; active: boolean }) =>
    patch<CampusLocation>(`/api/gates/${id}`, payload),
  deleteGate: (id: string) => del<{ id: string }>(`/api/gates/${id}`),
  assignGuardToGate: (gateId: string, guardId: string) =>
    patch<SecurityGuard>(`/api/gates/${gateId}`, { action: "assign", guardId }),

  guards: () => request<GuardRosterRow[]>("/api/guards"),
  guard: (id: string) => request<GuardProfile>(`/api/guards/${id}`),
  createGuard: (payload: Record<string, unknown>) => post<SecurityGuard>("/api/guards", payload),
  updateGuard: (id: string, payload: Record<string, unknown>) =>
    patch<SecurityGuard>(`/api/guards/${id}`, payload),
  deleteGuard: (id: string) => del<{ id: string }>(`/api/guards/${id}`),

  /* Students */
  requestOuting: (payload: Record<string, unknown>) => post<OutingRequest>("/api/outings", payload),
  decideOuting: (id: string, status: OutingStatus) =>
    patch<OutingRequest>(`/api/outings/${id}`, { status }),
  logMovement: (payload: Record<string, unknown>) => post<unknown>("/api/movements", payload),

  /* WhatsApp */
  whatsapp: (limit = 50) =>
    request<WhatsAppOverview>(`/api/whatsapp${query({ limit: String(limit) })}`),
  whatsappForBooking: (bookingId: string) =>
    request<{ messages: WhatsAppMessageRecord[] }>(
      `/api/whatsapp${query({ bookingId })}`,
    ).then((r) => r.messages),
  whatsappTemplates: () =>
    request<{ templates: WhatsAppTemplate[] }>("/api/whatsapp?view=templates").then(
      (r) => r.templates,
    ),
  sendWhatsAppTest: (countryCode: string, number: string) =>
    post<WhatsAppSendResult>("/api/whatsapp/test", { countryCode, number }),
  retryWhatsApp: (id: string) => post<WhatsAppSendResult>(`/api/whatsapp/${id}/retry`),

  /* Insights */
  settings: () => request<AppSettings>("/api/settings"),
  saveSettings: (payload: AppSettings) => put<AppSettings>("/api/settings", payload),
  report: (params: Record<string, string | undefined>) =>
    request<ReportResult>(`/api/reports${query(params)}`),
  analytics: (days = 14) =>
    request<{ title: string; data: { label: string; value: number }[] }[]>(
      `/api/analytics${query({ days: String(days) })}`,
    ),
  search: (q: string) => request<SearchHit[]>(`/api/search${query({ q })}`),
  activity: (limit = 200) =>
    request<ActivityLog[]>(`/api/activity${query({ limit: String(limit) })}`),
  resetDemoData: () => post<{ reset: boolean }>("/api/admin/reset"),
};

/** Friendly message for any thrown value — used by every toast in the app. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Per-field messages from a 422, for painting form inputs red. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError && error.details ? error.details : {};
}
