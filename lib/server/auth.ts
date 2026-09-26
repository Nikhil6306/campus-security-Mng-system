import "server-only";

import { cookies } from "next/headers";

import type { AuthSession, Role } from "@/lib/types";
import { all, get, run, tx } from "./db";
import { randomToken, verifyPassword } from "./password";

/**
 * Server-side authentication.
 *
 * Sessions are opaque random tokens stored in the `sessions` table and handed
 * to the browser in an httpOnly, SameSite=Lax cookie. Nothing about the caller's
 * identity — id, role, gate — travels in a client-readable value, so a role can
 * never be forged by editing storage. Every request re-reads the row, which is
 * also what makes sign-out and account deactivation take effect immediately.
 */

export const SESSION_COOKIE = "csms_session";
const SESSION_TTL_HOURS = 12;

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  name: string;
  role: Role;
  ref_id: string | null;
  gate: string | null;
  active: number;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function toSession(user: UserRow, loginAt: string): AuthSession {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    refId: user.ref_id ?? undefined,
    gate: user.gate ?? undefined,
    loginAt,
  };
}

/* ------------------------------------------------------------------ *
 * Sign in / sign out
 * ------------------------------------------------------------------ */

export interface SignInResult {
  session: AuthSession;
  token: string;
}

/**
 * Verifies credentials and opens a session.
 *
 * The "no account" and "wrong password" paths return the same message on
 * purpose — distinguishing them would let anyone enumerate valid staff emails.
 */
export function signIn(email: string, password: string): SignInResult {
  const user = get<UserRow>("SELECT * FROM app_users WHERE lower(email) = lower(?)", [
    email.trim(),
  ]);

  const invalid = new AuthError("Incorrect email or password.", 401);
  if (!user) {
    // Spend comparable time so a missing account is not detectably faster.
    verifyPassword(password, { hash: "0".repeat(128), salt: "0".repeat(32) });
    throw invalid;
  }
  if (!verifyPassword(password, { hash: user.password_hash, salt: user.password_salt })) {
    throw invalid;
  }
  if (user.active !== 1) {
    throw new AuthError("This account has been deactivated. Contact the administrator.", 403);
  }

  const token = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_HOURS * 3600_000);

  tx(() => {
    run("DELETE FROM sessions WHERE expires_at < ?", [now.toISOString()]);
    run("INSERT INTO sessions(id, user_id, created_at, expires_at) VALUES(?,?,?,?)", [
      token,
      user.id,
      now.toISOString(),
      expires.toISOString(),
    ]);
    run("UPDATE app_users SET last_login_at = ? WHERE id = ?", [now.toISOString(), user.id]);
  });

  return { session: toSession(user, now.toISOString()), token };
}

export function signOutToken(token: string): void {
  run("DELETE FROM sessions WHERE id = ?", [token]);
}

/* ------------------------------------------------------------------ *
 * Reading the current session
 * ------------------------------------------------------------------ */

/** Resolves the caller's session, or null when signed out or expired. */
export async function currentSession(): Promise<AuthSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return sessionForToken(token);
}

export function sessionForToken(token: string): AuthSession | null {
  const row = get<UserRow & { created_at: string; expires_at: string }>(
    `SELECT u.*, s.created_at, s.expires_at
       FROM sessions s
       JOIN app_users u ON u.id = s.user_id
      WHERE s.id = ?`,
    [token],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    run("DELETE FROM sessions WHERE id = ?", [token]);
    return null;
  }
  if (row.active !== 1) return null;
  return toSession(row, row.created_at);
}

/** Throws {@link AuthError} unless the caller holds one of `roles`. */
export async function requireRole(...roles: Role[]): Promise<AuthSession> {
  const session = await currentSession();
  if (!session) throw new AuthError("You need to sign in to continue.", 401);
  if (roles.length && !roles.includes(session.role)) {
    throw new AuthError("Your role does not have access to this action.", 403);
  }
  return session;
}

export async function requireAuth(): Promise<AuthSession> {
  return requireRole();
}

/** Any staff account with campus-wide administrative reach. */
export async function requireAdmin(): Promise<AuthSession> {
  return requireRole("admin", "super_admin");
}

/** Admins plus the gate: the roles allowed to run check-in / check-out. */
export async function requireGateOperator(): Promise<AuthSession> {
  return requireRole("admin", "super_admin", "security");
}

/* ------------------------------------------------------------------ *
 * Account administration
 * ------------------------------------------------------------------ */

export interface AccountSummary {
  id: string;
  email: string;
  name: string;
  role: Role;
  refId: string | null;
  active: boolean;
  lastLoginAt?: string;
}

export function listAccounts(): AccountSummary[] {
  return all<{
    id: string;
    email: string;
    name: string;
    role: Role;
    ref_id: string | null;
    active: number;
    last_login_at: string | null;
  }>("SELECT id, email, name, role, ref_id, active, last_login_at FROM app_users ORDER BY role, name").map(
    (r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      refId: r.ref_id,
      active: r.active === 1,
      lastLoginAt: r.last_login_at ?? undefined,
    }),
  );
}

/** Revokes every open session for a user — used when an account is disabled. */
export function revokeSessionsFor(userId: string): void {
  run("DELETE FROM sessions WHERE user_id = ?", [userId]);
}
