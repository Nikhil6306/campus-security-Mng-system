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
  const message = error instanceof Error ? error.message : String(error);
  if (!/UNIQUE constraint failed|constraint failed/i.test(message)) return null;

  if (message.includes("uniq_host_slot")) {
    return conflict("That time slot has just been taken. Please choose another one.");
  }
  if (message.includes("uniq_visitor_slot")) {
    return conflict("A booking already exists for this visitor and time.");
  }
  if (message.includes("uniq_check_direction")) {
    return conflict("This booking has already been stamped at the gate.");
  }
  if (message.includes("uniq_vehicle_inside")) {
    return conflict("That vehicle is already recorded as inside the campus.");
  }
  if (message.includes("visitors.mobile")) {
    return conflict("A visitor with that mobile number already exists.");
  }
  if (message.includes("app_users.email")) {
    return conflict("An account with that email already exists.");
  }
  if (message.includes("employee_id")) {
    return conflict("That employee ID is already in use.");
  }
  if (message.includes("departments.name")) {
    return conflict("A department with that name already exists.");
  }
  return conflict("That change conflicts with an existing record.");
}
