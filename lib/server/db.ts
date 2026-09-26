import "server-only";

import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { COLUMN_MIGRATIONS, POST_MIGRATION_SQL, SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

/**
 * Database connection.
 *
 * The bundled driver is SQLite through Node's built-in `node:sqlite` module —
 * no native build step, no external service, real SQL with foreign keys and
 * transactions. `lib/server/repo.ts` is the only module that writes SQL for the
 * application; everything above it goes through the service layer.
 *
 * To run the same application on Supabase/PostgreSQL, apply the migrations in
 * `supabase/migrations/` and point `DATABASE_DRIVER=postgres` — see README.
 */

export type SqlValue = SQLInputValue;
export type Row = Record<string, unknown>;

const DB_PATH = resolve(
  process.cwd(),
  process.env.DATABASE_FILE ?? ".data/campus-security.db",
);

/**
 * Next.js re-evaluates server modules on every hot reload, which would open a
 * new handle to the same file each time. The connection is cached on
 * `globalThis` so a dev session keeps exactly one.
 */
const globalRef = globalThis as typeof globalThis & {
  __csmsDb?: DatabaseSync;
  __csmsSeeded?: boolean;
};

/**
 * Applies the additive column migrations.
 *
 * SQLite has no `ADD COLUMN IF NOT EXISTS`, so each column is checked against
 * `PRAGMA table_info` first. Running this against a current database does
 * nothing, which is what lets an existing `.data` file survive an upgrade
 * instead of having to be deleted and reseeded.
 */
function applyColumnMigrations(db: DatabaseSync): void {
  for (const migration of COLUMN_MIGRATIONS) {
    const columns = db
      .prepare(`PRAGMA table_info(${migration.table})`)
      .all() as { name: string }[];
    if (!columns.length) continue; // table not created yet — SCHEMA_SQL owns it
    if (columns.some((c) => c.name === migration.column)) continue;
    db.exec(migration.ddl);
  }
}

function openDatabase(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA_SQL);
  applyColumnMigrations(db);
  // Indexes that depend on migrated columns, so only now are they creatable.
  db.exec(POST_MIGRATION_SQL);
  db.prepare(
    "INSERT INTO schema_meta(key, value) VALUES('version', ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(String(SCHEMA_VERSION));
  return db;
}

/** Returns the shared connection, creating and migrating the file on first use. */
export function getDb(): DatabaseSync {
  if (!globalRef.__csmsDb) {
    globalRef.__csmsDb = openDatabase();
  }
  return globalRef.__csmsDb;
}

/* ------------------------------------------------------------------ *
 * Query helpers
 * ------------------------------------------------------------------ */

export function all<T = Row>(sql: string, params: SqlValue[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function get<T = Row>(sql: string, params: SqlValue[] = []): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, params: SqlValue[] = []): { changes: number } {
  const result = getDb().prepare(sql).run(...params);
  return { changes: Number(result.changes) };
}

/**
 * Runs `fn` inside a single write transaction.
 *
 * `BEGIN IMMEDIATE` takes the write lock up front so two concurrent gate
 * operations serialise instead of one failing halfway through. Any throw rolls
 * the whole unit back, which is what keeps a booking's status, its gate log and
 * its audit entry from ever drifting apart.
 */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* the transaction was already unwound by SQLite */
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ *
 * Column conversion — SQLite stores booleans as integers and structured
 * values as JSON text, so every read and write goes through these.
 * ------------------------------------------------------------------ */

export const toInt = (value: boolean): number => (value ? 1 : 0);
export const toBool = (value: unknown): boolean => value === 1 || value === true;
export const toText = (value: unknown): string => (value == null ? "" : String(value));
export const toOptText = (value: unknown): string | undefined =>
  value == null || value === "" ? undefined : String(value);
export const toNum = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function toJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ *
 * Identifier sequences
 * ------------------------------------------------------------------ */

/**
 * Allocates the next human-readable identifier for `prefix`.
 *
 * Must be called inside {@link tx}: the counter row is bumped in the same
 * transaction as the insert that consumes it, so a reference is never reused.
 */
export function nextId(
  prefix: string,
  opts: { withYear?: boolean; pad?: number; template?: (serial: string) => string } = {},
): string {
  const { withYear = false, pad = 4, template } = opts;
  const year = new Date().getFullYear();
  const key = withYear ? `${prefix}-${year}` : prefix;

  getDb()
    .prepare(
      "INSERT INTO counters(key, value) VALUES(?, 1) " +
        "ON CONFLICT(key) DO UPDATE SET value = value + 1",
    )
    .run(key);

  const row = get<{ value: number }>("SELECT value FROM counters WHERE key = ?", [key]);
  const serial = `${row?.value ?? 1}`.padStart(pad, "0");
  if (template) return template(serial);
  return withYear ? `${prefix}-${year}-${serial}` : `${prefix}-${serial}`;
}

/** Booking reference, e.g. `DSVV-VIS-2026-000124`. */
export function nextBookingRef(): string {
  return nextId("DSVV-VIS", { withYear: true, pad: 6 });
}

/** True when the database has no rows at all — used to trigger seeding. */
export function isEmpty(): boolean {
  const row = get<{ c: number }>("SELECT COUNT(*) AS c FROM app_users");
  return (row?.c ?? 0) === 0;
}

export function markSeeded(): void {
  globalRef.__csmsSeeded = true;
}

export function hasSeededThisProcess(): boolean {
  return globalRef.__csmsSeeded === true;
}

export const databasePath = DB_PATH;
