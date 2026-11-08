import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

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

export type SqlValue = SQLInputValue | boolean;
export type Row = Record<string, unknown>;

export type DatabaseDriver = "sqlite" | "postgres";

const configuredDriver = process.env.DATABASE_DRIVER?.trim().toLowerCase();
export const databaseDriver: DatabaseDriver =
  configuredDriver === "postgres" || (!configuredDriver && process.env.VERCEL)
    ? "postgres"
    : "sqlite";

const DB_PATH = resolve(
  process.cwd(),
  process.env.DATABASE_FILE ?? ".data/campus-security.db",
);
const POSTGRES_URL =
  process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();

/**
 * Next.js re-evaluates server modules on every hot reload, which would open a
 * new handle to the same file each time. The connection is cached on
 * `globalThis` so a dev session keeps exactly one.
 */
const globalRef = globalThis as typeof globalThis & {
  __csmsDb?: DatabaseSync;
  __csmsSeeded?: boolean;
  __csmsPgPool?: Pool;
};

const pgTransaction = new AsyncLocalStorage<PoolClient>();
const sqliteTransaction = new AsyncLocalStorage<boolean>();
let sqliteTail: Promise<void> = Promise.resolve();

function withSqliteLock<T>(action: () => T | Promise<T>): Promise<T> {
  const previous = sqliteTail;
  let release!: () => void;
  sqliteTail = new Promise<void>((resolveLock) => {
    release = resolveLock;
  });

  return previous.then(action).finally(release);
}

function getPostgresPool(): Pool {
  if (!POSTGRES_URL) {
    throw new Error(
      "SUPABASE_DB_URL or DATABASE_URL must be configured when DATABASE_DRIVER=postgres.",
    );
  }

  if (!globalRef.__csmsPgPool) {
    globalRef.__csmsPgPool = new Pool({
      connectionString: POSTGRES_URL,
      max: process.env.VERCEL ? 2 : 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      application_name: "campus-security-management",
    });
  }

  return globalRef.__csmsPgPool;
}

function postgresParams(params: SqlValue[]): unknown[] {
  return params.map((value) => (typeof value === "boolean" ? value : value));
}

function postgresPlaceholders(sql: string): string {
  let result = "";
  let parameter = 0;
  let quote: "'" | '"' | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      result += character;
      if (character === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      result += character;
      if (character === "*" && next === "/") {
        result += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (!quote && character === "-" && next === "-") {
      result += "--";
      index += 1;
      lineComment = true;
      continue;
    }

    if (!quote && character === "/" && next === "*") {
      result += "/*";
      index += 1;
      blockComment = true;
      continue;
    }

    if (quote) {
      result += character;
      if (character === quote) {
        if (next === quote) {
          result += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      result += character;
      continue;
    }

    if (character === "?") {
      parameter += 1;
      result += `$${parameter}`;
      continue;
    }

    result += character;
  }

  return result;
}

async function sqliteQuery<T>(action: () => T): Promise<T> {
  if (sqliteTransaction.getStore()) return action();
  return withSqliteLock(action);
}

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
  if (databaseDriver !== "sqlite") {
    throw new Error("getDb() is only available when DATABASE_DRIVER=sqlite.");
  }
  if (!globalRef.__csmsDb) {
    globalRef.__csmsDb = openDatabase();
  }
  return globalRef.__csmsDb;
}

/* ------------------------------------------------------------------ *
 * Query helpers
 * ------------------------------------------------------------------ */

export function all<T = Row>(sql: string, params: SqlValue[] = []): T[] {
  if (databaseDriver !== "sqlite") {
    throw new Error("Use dbAll() for asynchronous PostgreSQL queries.");
  }
  return getDb()
    .prepare(sql)
    .all(...params.map((value) => (typeof value === "boolean" ? Number(value) : value))) as T[];
}

export function get<T = Row>(sql: string, params: SqlValue[] = []): T | undefined {
  if (databaseDriver !== "sqlite") {
    throw new Error("Use dbGet() for asynchronous PostgreSQL queries.");
  }
  return getDb()
    .prepare(sql)
    .get(...params.map((value) => (typeof value === "boolean" ? Number(value) : value))) as
    | T
    | undefined;
}

export function run(sql: string, params: SqlValue[] = []): { changes: number } {
  if (databaseDriver !== "sqlite") {
    throw new Error("Use dbRun() for asynchronous PostgreSQL queries.");
  }
  const result = getDb()
    .prepare(sql)
    .run(...params.map((value) => (typeof value === "boolean" ? Number(value) : value)));
  return { changes: Number(result.changes) };
}

export async function dbAll<T extends QueryResultRow = Row>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T[]> {
  if (databaseDriver === "postgres") {
    const client = pgTransaction.getStore() ?? getPostgresPool();
    const result = await client.query<T>(
      postgresPlaceholders(sql),
      postgresParams(params),
    );
    return result.rows;
  }

  return sqliteQuery(() => all<T>(sql, params));
}

export async function dbGet<T extends QueryResultRow = Row>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T | undefined> {
  if (databaseDriver === "postgres") {
    const client = pgTransaction.getStore() ?? getPostgresPool();
    const result = await client.query<T>(
      postgresPlaceholders(sql),
      postgresParams(params),
    );
    return result.rows[0];
  }

  return sqliteQuery(() => get<T>(sql, params));
}

export async function dbRun(
  sql: string,
  params: SqlValue[] = [],
): Promise<{ changes: number }> {
  if (databaseDriver === "postgres") {
    const client = pgTransaction.getStore() ?? getPostgresPool();
    const result = await client.query(
      postgresPlaceholders(sql),
      postgresParams(params),
    );
    return { changes: result.rowCount ?? 0 };
  }

  return sqliteQuery(() => run(sql, params));
}

export async function dbTx<T>(fn: () => T | Promise<T>): Promise<T> {
  if (databaseDriver === "postgres") {
    const activeClient = pgTransaction.getStore();
    if (activeClient) return fn();

    const client = await getPostgresPool().connect();
    try {
      await client.query("BEGIN");
      const result = await pgTransaction.run(client, fn);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  if (sqliteTransaction.getStore()) return fn();

  return withSqliteLock(async () => {
    const db = getDb();
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = await sqliteTransaction.run(true, fn);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* SQLite already rolled the transaction back. */
      }
      throw error;
    }
  });
}

export async function dbNextId(
  prefix: string,
  opts: { withYear?: boolean; pad?: number; template?: (serial: string) => string } = {},
): Promise<string> {
  const { withYear = false, pad = 4, template } = opts;
  const year = new Date().getFullYear();
  const key = withYear ? `${prefix}-${year}` : prefix;

  await dbRun(
    "INSERT INTO counters(key, value) VALUES(?, 1) " +
      "ON CONFLICT(key) DO UPDATE SET value = counters.value + 1",
    [key],
  );
  const row = await dbGet<{ value: number }>(
    "SELECT value FROM counters WHERE key = ?",
    [key],
  );
  const serial = `${row?.value ?? 1}`.padStart(pad, "0");
  if (template) return template(serial);
  return withYear ? `${prefix}-${year}-${serial}` : `${prefix}-${serial}`;
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

export const toInt = (value: boolean): number | boolean =>
  databaseDriver === "postgres" ? value : value ? 1 : 0;
export const toBool = (value: unknown): boolean =>
  value === 1 || value === true || value === "t";
export const toText = (value: unknown): string => (value == null ? "" : String(value));
export const toOptText = (value: unknown): string | undefined =>
  value == null || value === "" ? undefined : String(value);
export const toNum = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function toJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") {
    return value !== undefined && value !== null ? (value as T) : fallback;
  }
  if (!value) return fallback;
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
