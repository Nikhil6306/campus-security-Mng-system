import { Platform } from 'react-native';
import { appStorage } from './storage';

/**
 * Mobile API Service connecting the Guard Mobile App to the Campus Security Management System backend.
 */

// Production backend URL — the mobile app always uses a real server.
// Set EXPO_PUBLIC_API_URL in your .env / EAS secrets to point at the deployed backend.
// Fallback: Expo's Android emulator loopback address (10.0.2.2) maps to the
// host's localhost; for a physical device the env var MUST be provided.
const DEFAULT_SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === 'development'
    ? Platform.select({
        android: 'http://10.0.2.2:3000',
        default: 'http://localhost:3000',
      })
    : '');

export const API_BASE_URL = DEFAULT_SERVER_URL ?? '';

export interface GuardSession {
  userId: string;
  name: string;
  email: string;
  role: string;
  gate?: string;
  token?: string;
  refId?: string;
  loginAt?: string;
}

export interface VerificationIssue {
  code: string;
  message: string;
}

export interface VerificationBooking {
  id: string;
  visitorId: string;
  fullName: string;
  mobile: string;
  whatsappCountryCode?: string;
  whatsappNumber?: string;
  photoUrl?: string | null;
  photoPath?: string | null;
  purpose: string;
  purposeDetail?: string | null;
  hostName: string;
  department: string;
  visitDate: string;
  visitTime: string;
  expectedDuration?: string;
  numberOfVisitors?: number;
  hasCar?: boolean;
  carNumber?: string;
  vehicleRequired?: boolean;
  vehicleNumber?: string;
  status: string;
  badgeNumber?: string;
  checkInAt?: string;
  checkedInBy?: string;
  checkOutAt?: string;
  checkedOutBy?: string;
  gate?: string;
}

export interface CheckLogItem {
  id: string;
  direction: 'In' | 'Out';
  gate: string;
  guardName: string;
  at: string;
  note?: string | null;
}

export interface MobileVerificationResult {
  ok: boolean;
  booking?: VerificationBooking;
  issues: VerificationIssue[];
  nextAction?: 'check-in' | 'check-out';
  history?: CheckLogItem[];
  isDemo?: boolean;
}

export interface MobileGateResult {
  success: boolean;
  booking?: VerificationBooking;
  guardName?: string;
  gate?: string;
  timestamp?: string;
  error?: string;
}

export interface GuardDashboardData {
  stats: {
    totalAssignedGuards: number;
    activeGuardsOnDuty: number;
    gatesStaffed: number;
    totalGates: number;
    pendingHandovers: number;
    understaffedGates: string[];
    criticalPatrolAlerts: number;
  };
  assignments: any[];
  handovers: any[];
  liveSummary?: {
    visitorsToday: number;
    visitorsInside: number;
    vehiclesInside: number;
    openIncidents: number;
  };
}

// Current active in-memory session
let currentSession: GuardSession | null = null;

export const getGuardSession = () => currentSession;
export const setGuardSession = (session: GuardSession | null) => {
  currentSession = session;
  if (session) {
    appStorage.setItem('session', JSON.stringify(session)).catch(() => {});
  } else {
    appStorage.removeItem('session').catch(() => {});
  }
};

/**
 * Restores a persisted session from storage on app startup.
 */
export async function restoreGuardSession(): Promise<GuardSession | null> {
  try {
    const raw = await appStorage.getItem('session');
    if (raw) {
      const parsed = JSON.parse(raw) as GuardSession;
      currentSession = parsed;
      return parsed;
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

/**
 * Builds request headers with Bearer authentication.
 */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (currentSession?.token) {
    headers['Authorization'] = `Bearer ${currentSession.token}`;
  }
  return headers;
}

/**
 * Signs in the security guard using real backend authentication.
 * Enforces role restriction (guards & admins only).
 */
export async function loginGuard(
  email: string,
  password: string,
): Promise<{ success: boolean; session?: GuardSession; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const userRole = data.data?.session?.role;
      // Strict role check for mobile guard app
      if (userRole !== 'security' && userRole !== 'admin' && userRole !== 'super_admin') {
        return {
          success: false,
          error: 'Access denied: This mobile application is restricted to authorized campus security guards and gate officers.',
        };
      }

      const session: GuardSession = {
        userId: data.data?.session?.userId || 'guard-auth',
        name: data.data?.session?.name || 'Security Officer',
        email: data.data?.session?.email || email,
        role: userRole,
        gate: data.data?.session?.gate || 'Main Gate',
        refId: data.data?.session?.refId,
        token: data.data?.token,
        loginAt: data.data?.session?.loginAt || new Date().toISOString(),
      };
      setGuardSession(session);
      return { success: true, session };
    }

    return {
      success: false,
      error: data.error?.message || 'Invalid guard credentials or access not authorized.',
    };
  } catch (err) {
    return {
      success: false,
      error: 'Cannot reach the campus server. Please check your network connection or verify that the server is online.',
    };
  }
}

/**
 * Signs out the guard and clears local storage.
 */
export async function logoutGuard(): Promise<void> {
  try {
    if (currentSession?.token) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: authHeaders(),
      }).catch(() => {});
    }
  } finally {
    setGuardSession(null);
  }
}

/**
 * Verifies a scanned QR code or manually typed reference against backend.
 */
export async function verifyVisitorPass(input: { token?: string; bookingId?: string }): Promise<MobileVerificationResult> {
  const payload = input.token
    ? { token: input.token.trim() }
    : { bookingId: input.bookingId?.trim() };

  try {
    const res = await fetch(`${API_BASE_URL}/api/gate/verify`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.data) {
      return {
        ok: json.data.ok,
        booking: json.data.booking,
        issues: json.data.issues || [],
        nextAction: json.data.nextAction,
        history: json.data.history || [],
        isDemo: false,
      };
    }

    return {
      ok: false,
      issues: json.error?.message
        ? [{ code: json.error.code || 'error', message: json.error.message }]
        : [{ code: 'not_found', message: 'No booking record found for this pass.' }],
      isDemo: false,
    };
  } catch (networkErr) {
    return {
      ok: false,
      issues: [{ code: 'network_error', message: 'Server unreachable. Passes cannot be verified offline.' }],
      isDemo: false,
    };
  }
}

/**
 * Marks visitor IN at gate.
 */
export async function markVisitorIn(bookingId: string, gate = 'Main Gate', note?: string): Promise<MobileGateResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/gate/check-in`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ bookingId, gate, note }),
    });

    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return {
        success: true,
        booking: json.data?.booking,
        guardName: json.data?.guardName || currentSession?.name,
        gate: json.data?.gate || gate,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    return {
      success: false,
      error: json.error?.message || 'Check-in could not be recorded.',
    };
  } catch (err) {
    return {
      success: false,
      error: 'Network connection failure. Check-in was not recorded.',
    };
  }
}

/**
 * Marks visitor OUT at gate.
 */
export async function markVisitorOut(bookingId: string, gate = 'Main Gate', note?: string): Promise<MobileGateResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/gate/check-out`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ bookingId, gate, note }),
    });

    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return {
        success: true,
        booking: json.data?.booking,
        guardName: json.data?.guardName || currentSession?.name,
        gate: json.data?.gate || gate,
        timestamp: new Date().toLocaleTimeString(),
      };
    }

    return {
      success: false,
      error: json.error?.message || 'Check-out could not be recorded.',
    };
  } catch (err) {
    return {
      success: false,
      error: 'Network connection failure. Check-out was not recorded.',
    };
  }
}

/**
 * Fetches real guard dashboard statistics.
 */
export async function getGuardDashboardData(date?: string): Promise<GuardDashboardData | null> {
  try {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    const [dashRes, stateRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/guard-duty/dashboard${q}`, { headers: authHeaders() }),
      fetch(`${API_BASE_URL}/api/state`, { headers: authHeaders() }),
    ]);

    const dashJson = await dashRes.json().catch(() => ({}));
    const stateJson = await stateRes.json().catch(() => ({}));

    if (dashRes.ok && dashJson.ok) {
      const stats = dashJson.data?.stats || {
        totalAssignedGuards: 4,
        activeGuardsOnDuty: 2,
        gatesStaffed: 2,
        totalGates: 3,
        pendingHandovers: 0,
        understaffedGates: [],
        criticalPatrolAlerts: 0,
      };

      const dbState = stateJson.data?.state || stateJson.data || stateJson.state || {};
      const visitors = dbState.visitRequests || dbState.visits || [];
      const vehicles = dbState.vehicles || [];
      const incidents = dbState.incidents || [];

      return {
        stats,
        assignments: dashJson.data?.assignments || [],
        handovers: dashJson.data?.handovers || [],
        liveSummary: {
          visitorsToday: visitors.length,
          visitorsInside: visitors.filter((v: any) => v.status === 'Checked In').length,
          vehiclesInside: vehicles.filter((v: any) => v.status === 'Inside').length,
          openIncidents: incidents.filter((i: any) => i.status === 'Open' || i.status === 'Investigating').length,
        },
      };
    }
  } catch (err) {
    console.warn('[mobile-api] getGuardDashboardData offline or error:', err);
  }
  return null;
}

/**
 * Guard Duty: Starts active shift session.
 */
export async function startGuardShift(assignmentId: string, notes?: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/guard-duty/shift/start`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ assignmentId, notes }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return { ok: true, data: json.data };
    }
    return { ok: false, error: json.error?.message || 'Could not start shift.' };
  } catch (err) {
    return { ok: false, error: 'Network failure while attempting to start shift.' };
  }
}

/**
 * Guard Duty: Ends shift and creates formal handover.
 */
export async function endGuardShift(payload: {
  sessionId: string;
  incomingGuardId?: string;
  equipmentDetails?: any[];
  generalNotes?: string;
  urgentIssues?: string;
}): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/guard-duty/shift/end`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return { ok: true, data: json.data };
    }
    return { ok: false, error: json.error?.message || 'Could not submit shift handover.' };
  } catch (err) {
    return { ok: false, error: 'Network failure while attempting to end shift.' };
  }
}

/**
 * Guard Duty: Acknowledges an incoming shift handover.
 */
export async function acknowledgeGuardHandover(
  handoverId: string,
  incomingNotes?: string,
  disputedItems?: any[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/guard-duty/handovers/${handoverId}/acknowledge`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ incomingNotes, disputedItems }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return { ok: true };
    }
    return { ok: false, error: json.error?.message || 'Could not acknowledge handover.' };
  } catch (err) {
    return { ok: false, error: 'Network failure while acknowledging handover.' };
  }
}

/**
 * Patrols: Fetches configured patrol routes.
 */
export async function getPatrolRoutes(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/guard-duty/patrols/routes`, {
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return json.data || [];
    }
  } catch {
    // Offline
  }
  return [];
}

/**
 * Patrols: Submits a checkpoint inspection.
 */
export async function submitPatrolCheckpoint(payload: {
  sessionId: string;
  checkpointId: string;
  status: 'Pass' | 'Fail' | 'N/A';
  observations?: string;
  photoUrl?: string;
  itemsChecked?: Record<string, boolean>;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/guard-duty/patrols/submit`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return { ok: true };
    }
    return { ok: false, error: json.error?.message || 'Could not submit patrol checkpoint.' };
  } catch (err) {
    return { ok: false, error: 'Network failure while submitting patrol.' };
  }
}

// Map mobile emergency categories to the shared website emergency types
function mapCategoryToType(
  category: string,
): 'Security Emergency' | 'Medical Emergency' | 'Fire Emergency' | 'Evacuation' | 'Suspicious Activity' {
  if (category === 'Medical Emergency') return 'Medical Emergency';
  if (category === 'Fire or Smoke') return 'Fire Emergency';
  if (category === 'Security Threat') return 'Security Emergency';
  if (category === 'Suspicious Activity') return 'Suspicious Activity';
  // 'Accident or Injury' | 'Other Emergency' → Evacuation as closest match
  return 'Evacuation';
}

/**
 * Emergency SOS: Raises an instant emergency alert.
 *
 * Posts to /api/emergency (the SHARED table used by both the mobile app and the
 * website admin dashboard), so that every alert a guard raises on the phone
 * immediately appears in the admin Emergency log with the guard's name.
 */
export async function triggerEmergencySos(payload: {
  category: 'Medical Emergency' | 'Fire or Smoke' | 'Security Threat' | 'Suspicious Activity' | 'Accident or Injury' | 'Other Emergency';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  title?: string;
  description?: string;
  area: string;
  building?: string;
  latitude?: number | null;
  longitude?: number | null;
  evidenceUrl?: string | null;
}): Promise<{ ok: boolean; incident?: any; error?: string }> {
  try {
    // Build the payload that /api/emergency expects
    const body = {
      type: mapCategoryToType(payload.category),
      severity: payload.severity,
      location: payload.area,
      note: payload.description ?? payload.title ?? undefined,
    };
    const res = await fetch(`${API_BASE_URL}/api/emergency`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      // /api/emergency returns the EmergencyAlert object directly (wrapped in ok/data or bare)
      const alert = json.data ?? json;
      return { ok: true, incident: { id: alert.id, category: payload.category, severity: payload.severity, area: payload.area, status: alert.status ?? 'Active' } };
    }
    return { ok: false, error: json.error?.message || 'Emergency alert could not be dispatched.' };
  } catch (err) {
    return { ok: false, error: 'Network error: Emergency alert could not reach the server.' };
  }
}

/**
 * Emergency SOS: Fetches real emergency incidents from the shared /api/emergency endpoint.
 * Returns the same list that the admin dashboard uses, so mobile and website stay in sync.
 */
export async function getEmergencyIncidents(status?: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/emergency`, {
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => ([]));
    // /api/emergency returns EmergencyAlert[] directly
    const list: any[] = Array.isArray(json) ? json : json.data ?? [];
    if (status) {
      return list.filter((e: any) => e.status === status);
    }
    return list;
  } catch (err) {
    console.warn('[mobile-api] getEmergencyIncidents error:', err);
  }
  return [];
}

/**
 * Safety Hazard: Reports a safety issue or physical hazard.
 */
export async function reportSafetyIssue(payload: {
  category: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  urgency: 'Low' | 'Medium' | 'High' | 'Immediate';
  title: string;
  description: string;
  area: string;
  building?: string;
  photoUrl?: string | null;
}): Promise<{ ok: boolean; issue?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/safety-issues`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && (json.ok || json.id)) {
      return { ok: true, issue: json.data || json };
    }
    return { ok: false, error: json.error?.message || 'Safety issue could not be reported.' };
  } catch (err) {
    return { ok: false, error: 'Network error: Safety issue report could not reach the server.' };
  }
}

/**
 * Safety Hazard: Fetches safety hazard issues from server.
 */
export async function getSafetyIssues(status?: string): Promise<any[]> {
  try {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/safety-issues${q}`, {
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => ([]));
    if (res.ok && Array.isArray(json)) {
      return json;
    }
  } catch (err) {
    console.warn('[mobile-api] getSafetyIssues error:', err);
  }
  return [];
}

/**
 * Student Outpass: Scans student digital pass at gate.
 */
export async function scanStudentOutpass(payload: {
  rawToken: string;
  direction: 'ENTRY' | 'EXIT';
  gate: string;
  note?: string;
  isOverride?: boolean;
}): Promise<{ allowed: boolean; reason?: string; pass?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/outpass/scan`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        allowed: Boolean(json.allowed),
        reason: json.reason,
        pass: json.pass,
      };
    }
    return { allowed: false, error: json.error?.message || 'Outpass scanning failed.' };
  } catch (err) {
    return { allowed: false, error: 'Network failure during outpass verification.' };
  }
}

/**
 * Fetches recent audit / gate activity logs.
 */
export async function getRecentActivity(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/activity`, {
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return json.data || [];
    }
  } catch {
    // Offline
  }
  return [];
}

/**
 * Fetches the security role-scoped database snapshot (visitors, incidents, movements).
 */
export async function getCampusSnapshot(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/state`, {
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.data?.state) {
      return json.data.state;
    }
  } catch (err) {
    console.warn('[mobile-api] getCampusSnapshot error:', err);
  }
  return null;
}

/**
 * Uploads a visitor photograph taken at the gate to /api/public/visitor-photo.
 * Returns the opaque photoId used for booking registration.
 */
export async function uploadVisitorPhoto(
  photoUri: string,
): Promise<{ ok: boolean; photoId?: string; error?: string }> {
  try {
    const filename = photoUri.split('/').pop() || 'visitor.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()}` : 'image/jpeg';

    const formData = new FormData();
    formData.append('photo', {
      uri: photoUri,
      name: filename,
      type,
    } as any);

    const res = await fetch(`${API_BASE_URL}/api/public/visitor-photo`, {
      method: 'POST',
      body: formData,
    });

    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.data?.photoId) {
      return { ok: true, photoId: json.data.photoId };
    }
    return { ok: false, error: json.error?.message || 'Failed to upload visitor photo.' };
  } catch (err) {
    return { ok: false, error: 'Network failure while uploading photograph.' };
  }
}

/**
 * Creates an authorized walk-in visitor booking at gate.
 */
export async function createWalkInBooking(payload: {
  fullName: string;
  mobile: string;
  purpose: string;
  hostName: string;
  gate: string;
  photoUri?: string;
  photoId?: string;
  idType?: string;
  idNumber?: string;
}): Promise<{ ok: boolean; booking?: any; error?: string }> {
  try {
    let resolvedPhotoId = payload.photoId;
    if (!resolvedPhotoId && payload.photoUri) {
      const uploadRes = await uploadVisitorPhoto(payload.photoUri);
      if (uploadRes.ok && uploadRes.photoId) {
        resolvedPhotoId = uploadRes.photoId;
      }
    }

    const now = new Date();
    // Ensure visitTime is within visiting hours (07:00 - 19:45) and strictly in the future today
    const target = new Date(now.getTime() + 15 * 60 * 1000);
    let h = target.getHours();
    let m = Math.ceil(target.getMinutes() / 5) * 5;
    if (m >= 60) {
      h += 1;
      m = 0;
    }
    if (h < 7) {
      h = 7;
      m = 0;
    } else if (h >= 20) {
      h = 19;
      m = 45;
    }
    const visitTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const res = await fetch(`${API_BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        fullName: payload.fullName,
        mobile: payload.mobile,
        purpose: payload.purpose,
        hostName: payload.hostName,
        gate: payload.gate,
        photoId: resolvedPhotoId,
        idType: payload.idType || 'Aadhaar Card',
        idNumber: payload.idNumber || 'Verified-At-Gate',
        visitDate: new Date().toISOString().split('T')[0],
        visitTime,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.data) {
      return { ok: true, booking: json.data };
    }
    return { ok: false, error: json.error?.message || 'Walk-in booking could not be created.' };
  } catch (err) {
    return { ok: false, error: 'Network failure while registering visitor.' };
  }
}

/**
 * Requests a password reset link sent to work email.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return { ok: true, message: json.data?.message || 'Password reset link sent to your registered email.' };
    }
    return { ok: false, error: json.error?.message || 'Password reset request failed.' };
  } catch (err) {
    return { ok: false, error: 'Network failure while requesting password reset.' };
  }
}

/**
 * Fetches the guard's own profile from /api/auth/me.
 */
export async function getMyProfile(): Promise<{ ok: boolean; profile?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return { ok: true, profile: json.data };
    }
    return { ok: false, error: json.error?.message || 'Could not load profile.' };
  } catch {
    return { ok: false, error: 'Network failure while loading profile.' };
  }
}

/**
 * Fetches visitors currently inside campus (Checked In status).
 */
export async function getCurrentVisitors(): Promise<any[]> {
  try {
    const snap = await getCampusSnapshot();
    if (snap?.visitRequests) {
      return snap.visitRequests.filter(
        (v: any) => v.status === 'Checked In' || v.status === 'Meeting In Progress'
      );
    }
  } catch {
    // offline
  }
  return [];
}

/**
 * Fetches visitor history with optional date range filter.
 */
export async function getVisitorHistory(dateFrom?: string, dateTo?: string): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    const q = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/bookings${q}`, {
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && (json.ok || Array.isArray(json.data))) {
      return Array.isArray(json.data) ? json.data : json.data?.bookings || [];
    }
    // Fallback: use snapshot
    const snap = await getCampusSnapshot();
    return snap?.visitRequests || [];
  } catch {
    return [];
  }
}

/**
 * Fetches past guard shift sessions for history view.
 */
export async function getShiftHistory(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/guard-duty/shift/history`, {
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return json.data || [];
    }
  } catch {
    // offline
  }
  return [];
}

/**
 * Checks network connectivity by pinging the backend health endpoint.
 */
export async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_BASE_URL}/api/state`, {
      headers: authHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}
