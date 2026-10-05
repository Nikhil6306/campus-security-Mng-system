import "server-only";

/**
 * Relational schema for the campus security database.
 *
 * The statements below are the SQLite dialect used by the bundled server
 * database. The equivalent PostgreSQL / Supabase migration — same tables, same
 * columns, plus Row Level Security — lives in `supabase/migrations/`.
 *
 * Conventions:
 *  - Human-readable primary keys (`DSVV-VIS-2026-000124`, `GRD-003`) because
 *    security staff read and quote them out loud at the gate.
 *  - Timestamps are ISO-8601 UTC strings; dates are `yyyy-mm-dd`; times `HH:mm`.
 *  - Every status column carries a CHECK constraint so an invalid lifecycle
 *    value cannot be written even by a direct SQL client.
 */

export const SCHEMA_VERSION = 3;

export const SCHEMA_SQL = /* sql */ `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

/* ---------------------------------------------------------------- *
 * Identity
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS app_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('super_admin','admin','security','teacher','student')),
  ref_id        TEXT,
  gate          TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

/* ---------------------------------------------------------------- *
 * Organisation
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS departments (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  code       TEXT NOT NULL,
  head       TEXT NOT NULL DEFAULT '',
  location   TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teachers (
  id                  TEXT PRIMARY KEY,
  employee_id         TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT NOT NULL,
  department_id       TEXT REFERENCES departments(id) ON DELETE SET NULL,
  designation         TEXT NOT NULL DEFAULT '',
  photo_url           TEXT,
  room                TEXT NOT NULL DEFAULT '',
  availability_status TEXT NOT NULL DEFAULT 'Available'
                      CHECK (availability_status IN ('Available','Busy','On Leave','Unavailable')),
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teachers_department ON teachers(department_id);

CREATE TABLE IF NOT EXISTS teacher_availability (
  teacher_id   TEXT PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
  days         TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
  start_time   TEXT NOT NULL DEFAULT '09:00',
  end_time     TEXT NOT NULL DEFAULT '17:00',
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  blocked      TEXT NOT NULL DEFAULT '[]',
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS security_guards (
  id                TEXT PRIMARY KEY,
  employee_id       TEXT NOT NULL UNIQUE,
  full_name         TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT NOT NULL DEFAULT '',
  photo_url         TEXT,
  shift             TEXT NOT NULL CHECK (shift IN ('Morning','Evening','Night','General')),
  shift_start       TEXT NOT NULL,
  shift_end         TEXT NOT NULL,
  assigned_gate     TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('Active','On Duty','Off Duty','On Leave','Suspended')),
  joining_date      TEXT NOT NULL,
  emergency_contact TEXT NOT NULL DEFAULT '',
  address           TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_guards_status ON security_guards(status);
CREATE INDEX IF NOT EXISTS idx_guards_gate ON security_guards(assigned_gate);

CREATE TABLE IF NOT EXISTS students (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  roll_no        TEXT NOT NULL UNIQUE,
  department_id  TEXT REFERENCES departments(id) ON DELETE SET NULL,
  year           TEXT NOT NULL DEFAULT '',
  hostel         TEXT NOT NULL DEFAULT '',
  room           TEXT NOT NULL DEFAULT '',
  guardian_name  TEXT NOT NULL DEFAULT '',
  guardian_phone TEXT NOT NULL DEFAULT '',
  on_campus      INTEGER NOT NULL DEFAULT 1
);

/* ---------------------------------------------------------------- *
 * Visitors and bookings
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS visitors (
  id                TEXT PRIMARY KEY,
  full_name         TEXT NOT NULL,
  mobile            TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL DEFAULT '',
  gender            TEXT NOT NULL DEFAULT 'Prefer not to say',
  id_type           TEXT NOT NULL DEFAULT 'Aadhaar Card',
  id_number         TEXT NOT NULL DEFAULT '',
  photo_url         TEXT,
  organization      TEXT NOT NULL DEFAULT '',
  address           TEXT NOT NULL DEFAULT '',
  emergency_contact TEXT NOT NULL DEFAULT '',
  visitor_type      TEXT NOT NULL DEFAULT 'Guest',
  total_visits      INTEGER NOT NULL DEFAULT 0,
  blacklisted       INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visitors_name ON visitors(full_name);

CREATE TABLE IF NOT EXISTS visit_requests (
  id                  TEXT PRIMARY KEY,
  visitor_id          TEXT NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  full_name           TEXT NOT NULL,
  mobile              TEXT NOT NULL,
  email               TEXT NOT NULL DEFAULT '',
  gender              TEXT NOT NULL DEFAULT 'Prefer not to say',
  organization        TEXT NOT NULL DEFAULT '',
  address             TEXT NOT NULL DEFAULT '',
  emergency_contact   TEXT NOT NULL DEFAULT '',
  visitor_type        TEXT NOT NULL,
  id_type             TEXT NOT NULL,
  id_number           TEXT NOT NULL,
  photo_url           TEXT,
  purpose             TEXT NOT NULL,
  purpose_detail      TEXT,
  host_id             TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  host_name           TEXT NOT NULL DEFAULT '',
  department_id       TEXT REFERENCES departments(id) ON DELETE SET NULL,
  department          TEXT NOT NULL DEFAULT '',
  visit_date          TEXT NOT NULL,
  visit_time          TEXT NOT NULL,
  expected_duration   TEXT NOT NULL DEFAULT '30 minutes',
  number_of_visitors  INTEGER NOT NULL DEFAULT 1,
  vehicle_required    INTEGER NOT NULL DEFAULT 0,
  vehicle_number      TEXT,
  notes               TEXT,
  special_requirements TEXT,
  status              TEXT NOT NULL CHECK (status IN (
                        'Pending','Approved','Rejected','Rescheduled','Cancelled',
                        'Checked In','Meeting In Progress','Checked Out','No Show','Expired')),
  source              TEXT NOT NULL DEFAULT 'Visitor Portal',
  pass_token          TEXT,
  badge_number        TEXT,
  decided_at          TEXT,
  decided_by          TEXT,
  rejection_reason    TEXT,
  rescheduled_from    TEXT,
  check_in_at         TEXT,
  checked_in_by       TEXT,
  check_out_at        TEXT,
  checked_out_by      TEXT,
  meeting_started_at  TEXT,
  meeting_ended_at    TEXT,
  gate                TEXT,
  idempotency_key     TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visit_requests(status);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visit_requests(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_host ON visit_requests(host_id);
CREATE INDEX IF NOT EXISTS idx_visits_mobile ON visit_requests(mobile);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visit_requests(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_pass_token ON visit_requests(pass_token);

/* One live booking per host slot: partial unique index ignores the closed
   lifecycle states so a rejected slot can be rebooked. */
CREATE UNIQUE INDEX IF NOT EXISTS uniq_host_slot
  ON visit_requests(host_id, visit_date, visit_time)
  WHERE host_id IS NOT NULL
    AND status IN ('Pending','Approved','Rescheduled','Checked In','Meeting In Progress');

/* The same visitor cannot hold two live bookings for the same date and time. */
CREATE UNIQUE INDEX IF NOT EXISTS uniq_visitor_slot
  ON visit_requests(visitor_id, visit_date, visit_time)
  WHERE status IN ('Pending','Approved','Rescheduled','Checked In','Meeting In Progress');

/* ---------------------------------------------------------------- *
 * Accompanying visitors
 *
 * One row per additional person named on a booking. Aadhaar is never stored
 * in the clear: aadhaar_ciphertext holds an AES-256-GCM envelope when the
 * deployment sets AADHAAR_ENCRYPTION_KEY, and is NULL otherwise, in which
 * case only aadhaar_last4 survives. aadhaar_last4 is the sole fragment any
 * interface renders.
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS visit_guests (
  id                 TEXT PRIMARY KEY,
  booking_id         TEXT NOT NULL REFERENCES visit_requests(id) ON DELETE CASCADE,
  position           INTEGER NOT NULL,
  full_name          TEXT NOT NULL,
  mobile             TEXT NOT NULL,
  aadhaar_ciphertext TEXT,
  aadhaar_hash       TEXT,
  aadhaar_last4      TEXT NOT NULL,
  relation           TEXT NOT NULL,
  address            TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_guests_booking ON visit_guests(booking_id);
/* Guests are numbered 2..n within a booking and never duplicated. */
CREATE UNIQUE INDEX IF NOT EXISTS uniq_guest_position ON visit_guests(booking_id, position);

CREATE TABLE IF NOT EXISTS check_logs (
  id               TEXT PRIMARY KEY,
  visit_request_id TEXT NOT NULL REFERENCES visit_requests(id) ON DELETE CASCADE,
  visitor_id       TEXT NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  visitor_name     TEXT NOT NULL,
  direction        TEXT NOT NULL CHECK (direction IN ('In','Out')),
  gate             TEXT NOT NULL,
  guard_id         TEXT REFERENCES security_guards(id) ON DELETE SET NULL,
  guard_name       TEXT NOT NULL DEFAULT '',
  note             TEXT,
  at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_check_logs_visit ON check_logs(visit_request_id);
CREATE INDEX IF NOT EXISTS idx_check_logs_guard ON check_logs(guard_id);
CREATE INDEX IF NOT EXISTS idx_check_logs_at ON check_logs(at);

/* A booking may only be stamped once per direction — the gate cannot create
   duplicate check-in records even under a double-tap or a replayed request. */
CREATE UNIQUE INDEX IF NOT EXISTS uniq_check_direction
  ON check_logs(visit_request_id, direction);

/* ---------------------------------------------------------------- *
 * Campus movement
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS vehicles (
  id              TEXT PRIMARY KEY,
  vehicle_number  TEXT NOT NULL,
  vehicle_type    TEXT NOT NULL,
  visitor_name    TEXT NOT NULL DEFAULT '',
  driver_name     TEXT NOT NULL DEFAULT '',
  purpose         TEXT NOT NULL DEFAULT '',
  gate            TEXT NOT NULL,
  entry_time      TEXT NOT NULL,
  exit_time       TEXT,
  status          TEXT NOT NULL CHECK (status IN ('Inside','Exited')),
  linked_visit_id TEXT REFERENCES visit_requests(id) ON DELETE SET NULL,
  guard_id        TEXT REFERENCES security_guards(id) ON DELETE SET NULL,
  guard_name      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicles(vehicle_number);

/* A number plate can only be inside the campus once at a time. */
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicle_inside
  ON vehicles(vehicle_number) WHERE status = 'Inside';

CREATE TABLE IF NOT EXISTS outings (
  id                TEXT PRIMARY KEY,
  student_id        TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name      TEXT NOT NULL,
  type              TEXT NOT NULL,
  reason            TEXT NOT NULL DEFAULT '',
  from_date         TEXT NOT NULL,
  to_date           TEXT NOT NULL,
  guardian_approved INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL CHECK (status IN ('Pending','Approved','Rejected','Completed')),
  decided_by        TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outings_status ON outings(status);

CREATE TABLE IF NOT EXISTS movements (
  id          TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL,
  person_name TEXT NOT NULL,
  person_type TEXT NOT NULL CHECK (person_type IN ('Student','Visitor','Staff')),
  direction   TEXT NOT NULL CHECK (direction IN ('Entry','Exit')),
  gate        TEXT NOT NULL,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_at ON movements(at);

/* ---------------------------------------------------------------- *
 * Safety
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS incidents (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  location        TEXT NOT NULL,
  date            TEXT NOT NULL,
  time            TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('Low','Medium','High','Critical')),
  description     TEXT NOT NULL DEFAULT '',
  reported_by     TEXT NOT NULL,
  reported_by_id  TEXT REFERENCES security_guards(id) ON DELETE SET NULL,
  assigned_to_id  TEXT REFERENCES security_guards(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  attachment_url  TEXT,
  status          TEXT NOT NULL CHECK (status IN ('Open','Investigating','Resolved','Closed')),
  resolution_note TEXT,
  resolved_at     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(date);

CREATE TABLE IF NOT EXISTS emergencies (
  id                TEXT PRIMARY KEY,
  type              TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('Low','Medium','High','Critical')),
  location          TEXT NOT NULL,
  note              TEXT,
  triggered_by      TEXT NOT NULL,
  triggered_by_id   TEXT,
  triggered_at      TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('Active','Acknowledged','Resolved')),
  acknowledged_at   TEXT,
  acknowledged_by   TEXT,
  resolved_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_emergencies_status ON emergencies(status);

/* ---------------------------------------------------------------- *
 * Notifications, audit and configuration
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS notifications (
  id       TEXT PRIMARY KEY,
  type     TEXT NOT NULL,
  title    TEXT NOT NULL,
  message  TEXT NOT NULL,
  href     TEXT,
  audience TEXT,
  read     INTEGER NOT NULL DEFAULT 0,
  at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_at ON notifications(at);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

CREATE TABLE IF NOT EXISTS activity_logs (
  id         TEXT PRIMARY KEY,
  actor_id   TEXT,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  summary    TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT 'web',
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity_logs(at);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity, entity_id);

/* ---------------------------------------------------------------- *
 * WhatsApp delivery log
 * ---------------------------------------------------------------- */

/* One row per outbound WhatsApp message.
   The dedupe_key is what makes a retry safe: the send path writes the row first
   and only then talks to the provider, so a replayed request collides on the
   unique index instead of sending the visitor a second copy. */
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id                  TEXT PRIMARY KEY,
  booking_id          TEXT REFERENCES visit_requests(id) ON DELETE CASCADE,
  visitor_id          TEXT REFERENCES visitors(id) ON DELETE SET NULL,
  phone_number        TEXT NOT NULL,
  message_type        TEXT NOT NULL,
  dedupe_key          TEXT NOT NULL UNIQUE,
  body                TEXT NOT NULL DEFAULT '',
  provider            TEXT NOT NULL DEFAULT 'mock',
  provider_message_id TEXT,
  status              TEXT NOT NULL CHECK (status IN ('QUEUED','SENT','DELIVERED','READ','FAILED')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  error_message       TEXT,
  sent_at             TEXT,
  delivered_at        TEXT,
  read_at             TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_booking ON whatsapp_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_created ON whatsapp_messages(created_at);

CREATE TABLE IF NOT EXISTS campus_locations (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL UNIQUE,
  kind   TEXT NOT NULL CHECK (kind IN ('Gate','Block','Hostel','Facility')),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS app_settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

/* Sequence table behind the human-readable identifiers. Incremented inside the
   same transaction as the insert, so two concurrent bookings cannot collide. */
CREATE TABLE IF NOT EXISTS counters (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
`;

/**
 * Indexes over columns that COLUMN_MIGRATIONS adds.
 *
 * These cannot sit in SCHEMA_SQL: on a database created before those columns
 * existed the index would reference a missing column, and SQLite would abort
 * the rest of the script with it. Applied after the migrations instead, where
 * the column is guaranteed to be present.
 */
export const POST_MIGRATION_SQL = /* sql */ `
CREATE INDEX IF NOT EXISTS idx_visits_whatsapp ON visit_requests(whatsapp_number);

/* Replay guard: a repeated submission carrying the key of one already
   accepted resolves to that booking instead of creating a second one. */
CREATE UNIQUE INDEX IF NOT EXISTS uniq_visits_idempotency
  ON visit_requests(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
`;

/**
 * Additive column migrations.
 *
 * `CREATE TABLE IF NOT EXISTS` cannot widen a table that already exists, so
 * columns introduced after v1 are added here instead. Each entry is applied
 * only when the column is genuinely absent, which makes running this on an
 * up-to-date database a no-op rather than an error.
 */
export const COLUMN_MIGRATIONS: { table: string; column: string; ddl: string }[] = [
  {
    table: "visit_requests",
    column: "idempotency_key",
    ddl: "ALTER TABLE visit_requests ADD COLUMN idempotency_key TEXT",
  },
  {
    /* The number the faculty member is reachable on for visit requests. Kept
       separate from `phone`: a desk extension is not a WhatsApp account. */
    table: "teachers",
    column: "whatsapp_number",
    ddl: "ALTER TABLE teachers ADD COLUMN whatsapp_number TEXT NOT NULL DEFAULT ''",
  },
  {
    /* When the visitor pass stops being admissible. */
    table: "visit_requests",
    column: "pass_expires_at",
    ddl: "ALTER TABLE visit_requests ADD COLUMN pass_expires_at TEXT",
  },
  {
    table: "visit_requests",
    column: "whatsapp_country_code",
    ddl: "ALTER TABLE visit_requests ADD COLUMN whatsapp_country_code TEXT NOT NULL DEFAULT '+91'",
  },
  {
    table: "visit_requests",
    column: "whatsapp_number",
    ddl: "ALTER TABLE visit_requests ADD COLUMN whatsapp_number TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "visitors",
    column: "whatsapp_country_code",
    ddl: "ALTER TABLE visitors ADD COLUMN whatsapp_country_code TEXT NOT NULL DEFAULT '+91'",
  },
  {
    table: "visitors",
    column: "whatsapp_number",
    ddl: "ALTER TABLE visitors ADD COLUMN whatsapp_number TEXT NOT NULL DEFAULT ''",
  },
  {
    /* Storage path of the visitor's photograph, e.g.
       `visitor-photos/<id>.jpg`. Never the image itself: the bytes live in the
       private photo store, and this column only names them.

       Nullable on purpose. Photographs became mandatory for *new* bookings;
       rows written before that stay readable, and every interface falls back
       to initials where the column is NULL. */
    table: "visitors",
    column: "photo_url",
    ddl: "ALTER TABLE visitors ADD COLUMN photo_url TEXT",
  },
  {
    table: "visit_requests",
    column: "photo_url",
    ddl: "ALTER TABLE visit_requests ADD COLUMN photo_url TEXT",
  },
  {
    table: "visit_requests",
    column: "purpose_meta",
    ddl: "ALTER TABLE visit_requests ADD COLUMN purpose_meta TEXT DEFAULT '{}'",
  },
  {
    table: "visitors",
    column: "aadhaar_number",
    ddl: "ALTER TABLE visitors ADD COLUMN aadhaar_number TEXT",
  },
  {
    table: "visitors",
    column: "mobile_number",
    ddl: "ALTER TABLE visitors ADD COLUMN mobile_number TEXT",
  },
  {
    table: "visitors",
    column: "has_car",
    ddl: "ALTER TABLE visitors ADD COLUMN has_car INTEGER DEFAULT 0",
  },
  {
    table: "visitors",
    column: "car_number",
    ddl: "ALTER TABLE visitors ADD COLUMN car_number TEXT",
  },
  {
    table: "visitors",
    column: "photo_path",
    ddl: "ALTER TABLE visitors ADD COLUMN photo_path TEXT",
  },
  {
    table: "visit_requests",
    column: "aadhaar_number",
    ddl: "ALTER TABLE visit_requests ADD COLUMN aadhaar_number TEXT",
  },
  {
    table: "visit_requests",
    column: "mobile_number",
    ddl: "ALTER TABLE visit_requests ADD COLUMN mobile_number TEXT",
  },
  {
    table: "visit_requests",
    column: "has_car",
    ddl: "ALTER TABLE visit_requests ADD COLUMN has_car INTEGER DEFAULT 0",
  },
  {
    table: "visit_requests",
    column: "car_number",
    ddl: "ALTER TABLE visit_requests ADD COLUMN car_number TEXT",
  },
  {
    table: "visit_requests",
    column: "photo_path",
    ddl: "ALTER TABLE visit_requests ADD COLUMN photo_path TEXT",
  },
];
