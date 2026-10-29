"use client";

import * as React from "react";

import type { AuthSession, Role } from "@/lib/types";
import { isAdminRole } from "@/lib/types";
import { useApp } from "./data-provider";

/**
 * Session access for the interface.
 *
 * The session object here is a copy of what the server decided, delivered
 * alongside the snapshot. It exists so the UI can show the right name and hide
 * irrelevant navigation — it is never the thing that grants access. Every route
 * and every mutation re-derives the caller's role from the httpOnly session
 * cookie server-side, so editing anything in the browser changes nothing.
 */

interface AuthContextValue {
  ready: boolean;
  session: AuthSession | null;
  signIn: (email: string, password: string, expectedRole?: Role) => Promise<AuthSession>;
  signUp: (payload: { email: string; password: string; fullName: string; role?: Role; phone?: string }) => Promise<AuthSession | null>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
  resetPassword: (password: string, token?: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  /** Convenience predicates for navigation and empty states. */
  isAdmin: boolean;
  isSecurity: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isVisitor: boolean;
}

export function useAuth(): AuthContextValue {
  const { ready, session, signIn, signUp, forgotPassword, resetPassword, signOut } = useApp();
  return React.useMemo(
    () => ({
      ready,
      session,
      signIn,
      signUp,
      forgotPassword,
      resetPassword,
      signOut,
      isAdmin: isAdminRole(session?.role),
      isSecurity: session?.role === "security",
      isTeacher: session?.role === "teacher",
      isStudent: session?.role === "student",
      isVisitor: session?.role === "visitor",
    }),
    [ready, session, signIn, signUp, forgotPassword, resetPassword, signOut],
  );
}

/**
 * Kept as a component so the provider tree reads the same as before; the state
 * itself lives in {@link useApp}.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
