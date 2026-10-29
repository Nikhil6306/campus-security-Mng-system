import "server-only";

/**
 * Errors that are safe to show a user.
 *
 * Anything thrown as an {@link AppError} reaches the browser verbatim, so the
 * message must read like something a receptionist would say. Everything else —
 * SQL constraint text, stack traces, driver errors — is logged on the server
 * and replaced with a generic message by the route wrapper in `lib/server/http.ts`.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code: string = "bad_request",
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: Record<string, string>) =>
  new AppError(message, 400, "bad_request", details);

export const notFound = (message = "We could not find that record.") =>
  new AppError(message, 404, "not_found");

export const conflict = (message: string) => new AppError(message, 409, "conflict");

export const forbidden = (message = "Your role does not have access to this action.") =>
  new AppError(message, 403, "forbidden");

/**
 * Turns a database constraint violation into the sentence that explains it.
 *
 * The unique indexes in the schema are the real guard against double bookings
 * and duplicate gate stamps; this is what the user sees when one of them fires
 * because two requests raced past the application-level check.
 */
export function translateDbError(error: unknown): AppError | null {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (
    code === "23505" ||
    /UNIQUE constraint failed|constraint failed|duplicate key value/i.test(message)
  ) {
    if (
      message.includes("uniq_host_slot") ||
      message.includes("visit_requests_host_id_visit_date_visit_time_key")
    ) {
      return conflict("That time slot has just been taken. Please choose another one.");
    }
    if (
      message.includes("uniq_visitor_slot") ||
      message.includes("visit_requests_visitor_id_visit_date_visit_time_key")
    ) {
      return conflict("A booking already exists for this visitor and time.");
    }
    if (message.includes("uniq_check_direction")) {
      return conflict("This booking has already been stamped at the gate.");
    }
    if (message.includes("uniq_vehicle_inside")) {
      return conflict("That vehicle is already recorded as inside the campus.");
    }
    if (message.includes("visitors.mobile") || message.includes("visitors_mobile_key")) {
      return conflict("A visitor with that mobile number already exists.");
    }
    if (message.includes("app_users.email") || message.includes("profiles_email_key")) {
      return conflict("An account with that email already exists.");
    }
    if (message.includes("employee_id")) {
      return conflict("That employee ID is already in use.");
    }
    if (message.includes("departments.name") || message.includes("departments_name_key")) {
      return conflict("A department with that name already exists.");
    }
    return conflict("That change conflicts with an existing record.");
  }

  return null;
}

export function toApiError(error: unknown): import("next/server").NextResponse {
  const { NextResponse } = require("next/server");
  if (error instanceof AppError) {
    return NextResponse.json(
      { ok: false, error: { message: error.message, code: error.code, details: error.details } },
      { status: error.status },
    );
  }
  if (error && typeof error === "object" && "status" in error && "name" in error && (error as any).name === "AuthError") {
    const status = (error as any).status || 401;
    return NextResponse.json(
      { ok: false, error: { message: (error as any).message, code: status === 403 ? "forbidden" : "unauthorized" } },
      { status },
    );
  }
  const translated = translateDbError(error);
  if (translated) {
    return NextResponse.json(
      { ok: false, error: { message: translated.message, code: translated.code } },
      { status: translated.status },
    );
  }
  if (error && typeof error === "object" && "issues" in error) {
    return NextResponse.json(
      { ok: false, error: { message: "Validation failed", code: "validation_error", details: error } },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json(
    { ok: false, error: { message: "Something went wrong on our side. Please try again.", code: "internal_error" } },
    { status: 500 },
  );
}
