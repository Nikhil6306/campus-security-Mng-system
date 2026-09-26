import "server-only";

import { NextResponse } from "next/server";

import type { AuthSession, Role } from "@/lib/types";
import { AuthError, currentSession, requireRole } from "./auth";
import { getDb, hasSeededThisProcess, markSeeded } from "./db";
import { AppError, translateDbError } from "./errors";
import { seedIfEmpty } from "./seed";
import { buildSnapshot } from "./services/snapshot";

/**
 * Route plumbing.
 *
 * Wraps every API handler so that authorisation, validation failures and
 * database errors turn into one predictable envelope. Nothing a caller sees is
 * ever a raw driver message — unrecognised failures are logged with their stack
 * on the server and replaced with a sentence a receptionist could act on.
 */

export interface ApiEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  /** Fresh role-scoped snapshot, returned with every successful mutation. */
  state?: ReturnType<typeof buildSnapshot>;
  error?: { message: string; code: string; details?: Record<string, string> };
}

/** Opens the database and seeds it on the very first request of a process. */
export function bootstrap(): void {
  getDb();
  if (!hasSeededThisProcess()) {
    seedIfEmpty();
    markSeeded();
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json<ApiEnvelope<T>>({ ok: true, data }, init);
}

function fail(error: AppError | AuthError): NextResponse {
  const status = error.status;
  const code = error instanceof AppError ? error.code : status === 403 ? "forbidden" : "unauthorized";
  const details = error instanceof AppError ? error.details : undefined;
  return NextResponse.json<ApiEnvelope>(
    { ok: false, error: { message: error.message, code, details } },
    { status },
  );
}

function toApiError(error: unknown): AppError | AuthError {
  if (error instanceof AppError || error instanceof AuthError) return error;

  const translated = translateDbError(error);
  if (translated) return translated;

  console.error("[api] unhandled error", error);
  return new AppError(
    "Something went wrong on our side. Please try again.",
    500,
    "internal_error",
  );
}

/* ------------------------------------------------------------------ *
 * Handlers
 * ------------------------------------------------------------------ */

/** A route that does not require a signed-in caller. */
export async function publicRoute<T>(handler: () => Promise<T> | T): Promise<NextResponse> {
  try {
    bootstrap();
    return ok(await handler());
  } catch (error) {
    return fail(toApiError(error));
  }
}

/**
 * A read for a signed-in caller. `roles` narrows who may call it at all; the
 * snapshot each role receives is narrowed again in `services/snapshot.ts`.
 */
export async function authedRoute<T>(
  roles: Role[],
  handler: (session: AuthSession) => Promise<T> | T,
): Promise<NextResponse> {
  try {
    bootstrap();
    const session = await requireRole(...roles);
    return ok(await handler(session));
  } catch (error) {
    return fail(toApiError(error));
  }
}

/**
 * A write. On success the response carries the updated snapshot, so the client
 * never has to guess what changed or issue a follow-up read.
 */
export async function mutationRoute<T>(
  roles: Role[],
  handler: (session: AuthSession) => Promise<T> | T,
): Promise<NextResponse> {
  try {
    bootstrap();
    const session = await requireRole(...roles);
    const data = await handler(session);
    return NextResponse.json<ApiEnvelope<T>>({
      ok: true,
      data,
      state: buildSnapshot(session),
    });
  } catch (error) {
    return fail(toApiError(error));
  }
}

/** Reads and parses a JSON body, tolerating an empty one. */
export async function readBody(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    throw new AppError("The request body was not valid JSON.", 400, "bad_request");
  }
}

/** The caller's session, or null. Used by routes that serve both. */
export async function optionalSession(): Promise<AuthSession | null> {
  bootstrap();
  return currentSession();
}

export const ADMIN_ROLES: Role[] = ["admin", "super_admin"];
export const GATE_ROLES: Role[] = ["admin", "super_admin", "security"];
export const STAFF_ROLES: Role[] = ["admin", "super_admin", "security", "teacher"];
export const ALL_ROLES: Role[] = ["admin", "super_admin", "security", "teacher", "student"];

/**
 * True when the request reached us over TLS.
 *
 * Used to decide the `Secure` flag on the session cookie. A proxy that
 * terminates TLS forwards the original scheme in `x-forwarded-proto`; without
 * one, the request URL is authoritative.
 */
export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim().toLowerCase() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}
