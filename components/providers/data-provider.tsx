"use client";

import * as React from "react";

import { ApiError, api, errorMessage, onSnapshot } from "@/lib/api";
import type { AppDatabase, AuthSession, Role } from "@/lib/types";

/**
 * Application state.
 *
 * Holds the role-scoped snapshot the server sent, the current session, and the
 * live connection that keeps both fresh. There is no client-side database: the
 * browser reads what it is given and writes through the API, so what it renders
 * is always what the server was willing to disclose.
 */

const EMPTY_DB: AppDatabase = {
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
  settings: {
    campusName: "Dev Sanskriti Vishwavidyalaya",
    campusAddress: "",
    contactEmail: "",
    securityDeskPhone: "",
    visitingHoursFrom: "07:00",
    visitingHoursTo: "20:00",
    maxVisitorsPerBooking: 20,
    advanceBookingDays: 90,
    defaultMeetingMinutes: 30,
    requireIdProof: true,
    requireVehicleDetails: true,
    autoExpireHours: 24,
    allowedVisitorTypes: [],
    notifyRequests: true,
    notifyGate: true,
    notifyIncidents: true,
  },
  syncedAt: "",
};

interface AppContextValue {
  /** False until the first snapshot has arrived. */
  ready: boolean;
  db: AppDatabase;
  session: AuthSession | null;
  /** True while a live connection to the change feed is open. */
  live: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string, expectedRole?: Role) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  /** Runs a mutation, surfaces a friendly error and keeps the snapshot in step. */
  run: <T>(operation: () => Promise<T>) => Promise<T>;
}

const AppContext = React.createContext<AppContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = React.useState<AppDatabase>(EMPTY_DB);
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [ready, setReady] = React.useState(false);
  const [live, setLive] = React.useState(false);

  // Mutations answer with a fresh snapshot; install it as it arrives.
  React.useEffect(() => {
    onSnapshot((state) => setDb(state));
    return () => onSnapshot(null);
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      const payload = await api.state();
      setSession(payload.session);
      setDb(payload.state);
    } catch (error) {
      // A lapsed session is an expected outcome here, not a failure to report.
      if (error instanceof ApiError && error.isAuthError) {
        setSession(null);
        setDb(EMPTY_DB);
        return;
      }
      throw error;
    } finally {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    void refresh().catch(() => setReady(true));
  }, [refresh]);

  /**
   * Live updates.
   *
   * The change feed pushes only that something changed; the snapshot is then
   * re-read through the same role-scoped endpoint as any other load. Bursts are
   * coalesced so a batch of gate activity causes one refresh, not ten.
   */
  React.useEffect(() => {
    if (!session) {
      setLive(false);
      return;
    }

    const source = new EventSource("/api/events");
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh().catch(() => undefined), 250);
    };

    source.addEventListener("ready", () => setLive(true));
    source.addEventListener("change", scheduleRefresh);
    source.onerror = () => setLive(false);

    return () => {
      if (timer) clearTimeout(timer);
      source.close();
      setLive(false);
    };
  }, [session, refresh]);

  /**
   * Polling fallback.
   *
   * Only runs while the live connection is down and the tab is visible, so a
   * proxy that strips SSE still gets a moving dashboard without a background
   * tab hammering the server.
   */
  React.useEffect(() => {
    if (!session || live) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    }, 15_000);
    return () => clearInterval(interval);
  }, [session, live, refresh]);

  const signIn = React.useCallback(
    async (email: string, password: string, expectedRole?: Role) => {
      const next = await api.signIn(email, password, expectedRole);
      setSession(next);
      await refresh();
      return next;
    },
    [refresh],
  );

  const signOut = React.useCallback(async () => {
    try {
      await api.signOut();
    } finally {
      setSession(null);
      setDb(EMPTY_DB);
    }
  }, []);

  const run = React.useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        // Re-throw with a message the caller can put straight into a toast.
        if (error instanceof ApiError) throw error;
        throw new ApiError(errorMessage(error), 0, "error");
      }
    },
    [],
  );

  const value = React.useMemo<AppContextValue>(
    () => ({ ready, db, session, live, refresh, signIn, signOut, run }),
    [ready, db, session, live, refresh, signIn, signOut, run],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <DataProvider>.");
  return ctx;
}

/** Data-only view of the context, for components that never mutate. */
export function useData(): Pick<AppContextValue, "ready" | "db" | "refresh" | "run" | "live"> {
  const { ready, db, refresh, run, live } = useApp();
  return { ready, db, refresh, run, live };
}

/** Convenience selector hook — recomputes when the snapshot changes. */
export function useSelector<T>(selector: (db: AppDatabase) => T): T {
  const { db } = useApp();
  return React.useMemo(() => selector(db), [db, selector]);
}
