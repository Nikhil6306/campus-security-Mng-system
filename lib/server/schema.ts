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
  role          TEXT NOT NULL CHECK (role IN ('super_admin','admin','security','teacher','student','visitor')),
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
  vehicle_type        TEXT,
  vehicle_number      TEXT,
  expected_departure_time TEXT,
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

/* ---------------------------------------------------------------- *
 * Faculty approval tokens (Signed WhatsApp action links)
 *
 * Cryptographically random, single-use, short-lived tokens.
 * Only SHA-256 token hashes are stored in the database.
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS approval_tokens (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  booking_id  TEXT NOT NULL REFERENCES visit_requests(id) ON DELETE CASCADE,
  faculty_id  TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('accept','reject','decide')),
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_booking ON approval_tokens(booking_id);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_faculty ON approval_tokens(faculty_id);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_hash ON approval_tokens(token_hash);

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

/* ---------------------------------------------------------------- *
 * Guard Duty & Shift Handover
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS gate_staffing_requirements (
  id           TEXT PRIMARY KEY,
  gate         TEXT NOT NULL,
  shift_type   TEXT NOT NULL CHECK (shift_type IN ('Morning','Evening','Night','Custom')),
  min_guards   INTEGER NOT NULL DEFAULT 1,
  ideal_guards INTEGER NOT NULL DEFAULT 2,
  updated_at   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gate_staffing ON gate_staffing_requirements(gate, shift_type);

CREATE TABLE IF NOT EXISTS guard_shift_assignments (
  id                 TEXT PRIMARY KEY,
  guard_id           TEXT NOT NULL REFERENCES security_guards(id) ON DELETE CASCADE,
  guard_name         TEXT NOT NULL,
  gate               TEXT NOT NULL,
  duty_date          TEXT NOT NULL,
  shift_type         TEXT NOT NULL CHECK (shift_type IN ('Morning','Evening','Night','Custom')),
  start_time         TEXT NOT NULL,
  end_time           TEXT NOT NULL,
  is_overnight       INTEGER NOT NULL DEFAULT 0,
  supervisor_id      TEXT,
  supervisor_name    TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL CHECK (status IN ('Scheduled','Active','Completed','Cancelled','Reassigned')),
  reassign_reason    TEXT,
  reassigned_from_id TEXT,
  notes              TEXT,
  created_by         TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_guard ON guard_shift_assignments(guard_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_date ON guard_shift_assignments(duty_date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_gate ON guard_shift_assignments(gate);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_status ON guard_shift_assignments(status);

CREATE TABLE IF NOT EXISTS guard_shift_sessions (
  id             TEXT PRIMARY KEY,
  assignment_id  TEXT NOT NULL UNIQUE REFERENCES guard_shift_assignments(id) ON DELETE CASCADE,
  guard_id       TEXT NOT NULL,
  guard_name     TEXT NOT NULL,
  gate           TEXT NOT NULL,
  actual_start   TEXT NOT NULL,
  actual_end     TEXT,
  checkin_status TEXT NOT NULL CHECK (checkin_status IN ('On-Time','Late','Early')),
  late_minutes   INTEGER NOT NULL DEFAULT 0,
  late_reason    TEXT,
  notes          TEXT,
  status         TEXT NOT NULL CHECK (status IN ('Active','Handover Pending','Completed','Exception')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_guard ON guard_shift_sessions(guard_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_status ON guard_shift_sessions(status);

CREATE TABLE IF NOT EXISTS patrol_routes (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  zone             TEXT NOT NULL,
  applicable_gates TEXT NOT NULL DEFAULT '[]',
  frequency_hours  INTEGER NOT NULL DEFAULT 2,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patrol_checkpoints (
  id             TEXT PRIMARY KEY,
  route_id       TEXT NOT NULL REFERENCES patrol_routes(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  location       TEXT NOT NULL,
  instructions   TEXT NOT NULL DEFAULT '',
  required_items TEXT NOT NULL DEFAULT '[]',
  order_index    INTEGER NOT NULL DEFAULT 1,
  photo_required INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_patrol_checkpoints_route ON patrol_checkpoints(route_id);

CREATE TABLE IF NOT EXISTS patrol_submissions (
  id                  TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL REFERENCES guard_shift_sessions(id) ON DELETE CASCADE,
  checkpoint_id       TEXT NOT NULL REFERENCES patrol_checkpoints(id) ON DELETE CASCADE,
  guard_id            TEXT NOT NULL,
  guard_name          TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('Pass','Fail','N/A')),
  observations        TEXT NOT NULL DEFAULT '',
  photo_url           TEXT,
  items_checked       TEXT NOT NULL DEFAULT '{}',
  escalated           INTEGER NOT NULL DEFAULT 0,
  escalation_notes    TEXT,
  submitted_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patrol_submissions_session ON patrol_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_patrol_submissions_chk ON patrol_submissions(checkpoint_id);

CREATE TABLE IF NOT EXISTS shift_handovers (
  id                       TEXT PRIMARY KEY,
  session_id               TEXT NOT NULL UNIQUE REFERENCES guard_shift_sessions(id) ON DELETE CASCADE,
  outgoing_guard_id        TEXT NOT NULL,
  outgoing_guard_name      TEXT NOT NULL,
  incoming_guard_id        TEXT,
  incoming_guard_name      TEXT NOT NULL DEFAULT '',
  gate                     TEXT NOT NULL,
  duty_date                TEXT NOT NULL,
  shift_type               TEXT NOT NULL,
  status                   TEXT NOT NULL CHECK (status IN (
                             'Draft','Submitted','Awaiting Incoming Guard','Acknowledged',
                             'Pending Supervisor Review','Approved','Rejected','Exception','Escalated')),
  equipment_details        TEXT NOT NULL DEFAULT '[]',
  general_notes            TEXT NOT NULL DEFAULT '',
  urgent_issues            TEXT NOT NULL DEFAULT '',
  pending_visitors_count   INTEGER NOT NULL DEFAULT 0,
  open_incidents_count     INTEGER NOT NULL DEFAULT 0,
  patrol_completed_count   INTEGER NOT NULL DEFAULT 0,
  patrol_total_count       INTEGER NOT NULL DEFAULT 0,
  submitted_at             TEXT,
  incoming_acknowledged_at TEXT,
  incoming_notes           TEXT,
  disputed_items           TEXT,
  supervisor_id            TEXT,
  supervisor_name          TEXT,
  supervisor_decision      TEXT,
  supervisor_notes         TEXT,
  rejection_reason         TEXT,
  decided_at               TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shift_handovers_status ON shift_handovers(status);
CREATE INDEX IF NOT EXISTS idx_shift_handovers_date ON shift_handovers(duty_date);
CREATE INDEX IF NOT EXISTS idx_shift_handovers_gate ON shift_handovers(gate);

CREATE TABLE IF NOT EXISTS shift_handover_items (
  id                       TEXT PRIMARY KEY,
  handover_id              TEXT NOT NULL REFERENCES shift_handovers(id) ON DELETE CASCADE,
  category                 TEXT NOT NULL CHECK (category IN ('Visitor','Incident','Equipment','Patrol')),
  reference_id             TEXT NOT NULL,
  title                    TEXT NOT NULL,
  severity_or_status       TEXT NOT NULL DEFAULT '',
  notes                    TEXT NOT NULL DEFAULT '',
  acknowledged_by_incoming INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_handover_items_handover ON shift_handover_items(handover_id);

/* ---------------------------------------------------------------- *
 * Emergency SOS — Enhanced Lifecycle
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS emergency_incidents (
  id               TEXT PRIMARY KEY,
  reporter_id      TEXT,
  reporter_name    TEXT NOT NULL,
  reporter_role    TEXT NOT NULL DEFAULT 'security',
  reporter_contact TEXT NOT NULL DEFAULT '',
  category         TEXT NOT NULL CHECK (category IN (
                     'Medical Emergency','Fire or Smoke','Security Threat',
                     'Suspicious Activity','Accident or Injury','Other Emergency')),
  severity         TEXT NOT NULL CHECK (severity IN ('Low','Medium','High','Critical')),
  title            TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  campus           TEXT NOT NULL DEFAULT 'Main Campus',
  building         TEXT NOT NULL DEFAULT '',
  area             TEXT NOT NULL DEFAULT '',
  latitude         REAL,
  longitude        REAL,
  evidence_url     TEXT,
  status           TEXT NOT NULL DEFAULT 'REPORTED'
                   CHECK (status IN (
                     'REPORTED','ACKNOWLEDGED','ASSIGNED','RESPONDING',
                     'ON_SCENE','RESOLVED','CLOSED','CANCELLED','ESCALATED')),
  assigned_guard_id   TEXT REFERENCES security_guards(id) ON DELETE SET NULL,
  assigned_guard_name TEXT,
  assigned_at         TEXT,
  reported_at       TEXT NOT NULL,
  acknowledged_at   TEXT,
  dispatched_at     TEXT,
  responding_at     TEXT,
  on_scene_at       TEXT,
  resolved_at       TEXT,
  closed_at         TEXT,
  resolution_summary TEXT,
  resolved_by        TEXT,
  ack_deadline_at    TEXT,
  escalated          INTEGER NOT NULL DEFAULT 0,
  escalation_note    TEXT,
  idempotency_key  TEXT UNIQUE,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ei_status   ON emergency_incidents(status);
CREATE INDEX IF NOT EXISTS idx_ei_severity ON emergency_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_ei_guard    ON emergency_incidents(assigned_guard_id);

CREATE TABLE IF NOT EXISTS incident_assignments (
  id          TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES emergency_incidents(id) ON DELETE CASCADE,
  guard_id    TEXT NOT NULL REFERENCES security_guards(id) ON DELETE CASCADE,
  guard_name  TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  reason      TEXT,
  active      INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_ia_incident ON incident_assignments(incident_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ia_active ON incident_assignments(incident_id) WHERE active = 1;

CREATE TABLE IF NOT EXISTS incident_events (
  id          TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES emergency_incidents(id) ON DELETE CASCADE,
  actor_id    TEXT,
  actor_name  TEXT NOT NULL,
  actor_role  TEXT NOT NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN (
                'CREATED','STATUS_CHANGED','ASSIGNED','REASSIGNED','NOTE_ADDED',
                'EVIDENCE_UPLOADED','BACKUP_REQUESTED','ESCALATED','CLOSED')),
  old_status  TEXT,
  new_status  TEXT,
  note        TEXT,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_iev_incident ON incident_events(incident_id);

/* ---------------------------------------------------------------- *
 * Safety Issues & Maintenance
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS safety_issues (
  id          TEXT PRIMARY KEY,
  category    TEXT NOT NULL CHECK (category IN (
                'Broken Gate/Door Lock','Damaged CCTV','Faulty Security Light',
                'Blocked Fire Exit','Missing/Damaged Fire Extinguisher',
                'Unsafe Electrical Condition','Damaged Boundary/Access Barrier',
                'Other Campus Safety Issue')),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  campus      TEXT NOT NULL DEFAULT 'Main Campus',
  building    TEXT NOT NULL DEFAULT '',
  area        TEXT NOT NULL DEFAULT '',
  severity    TEXT NOT NULL DEFAULT 'Medium'
              CHECK (severity IN ('Low','Medium','High','Critical')),
  urgency     TEXT NOT NULL DEFAULT 'Normal'
              CHECK (urgency IN ('Routine','Normal','Urgent','Immediate')),
  reporter_id   TEXT,
  reporter_name TEXT NOT NULL,
  reporter_role TEXT NOT NULL DEFAULT 'security',
  evidence_url  TEXT,
  assigned_to_id   TEXT,
  assigned_to_name TEXT,
  assigned_at      TEXT,
  deadline_at      TEXT,
  status      TEXT NOT NULL DEFAULT 'REPORTED'
              CHECK (status IN (
                'REPORTED','TRIAGED','ASSIGNED','IN_PROGRESS',
                'FIXED','VERIFIED','CLOSED','REOPENED','ESCALATED')),
  verified_by   TEXT,
  verified_at   TEXT,
  fix_notes     TEXT,
  evidence_fix_url TEXT,
  closed_at     TEXT,
  closure_note  TEXT,
  parent_issue_id TEXT REFERENCES safety_issues(id) ON DELETE SET NULL,
  reopen_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_si_status   ON safety_issues(status);
CREATE INDEX IF NOT EXISTS idx_si_severity ON safety_issues(severity);

CREATE TABLE IF NOT EXISTS maintenance_assignments (
  id            TEXT PRIMARY KEY,
  issue_id      TEXT NOT NULL REFERENCES safety_issues(id) ON DELETE CASCADE,
  assignee_id   TEXT,
  assignee_name TEXT NOT NULL,
  assigned_by   TEXT NOT NULL,
  assigned_at   TEXT NOT NULL,
  deadline_at   TEXT,
  notes         TEXT,
  active        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_ma_issue ON maintenance_assignments(issue_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ma_active ON maintenance_assignments(issue_id) WHERE active = 1;

CREATE TABLE IF NOT EXISTS maintenance_events (
  id         TEXT PRIMARY KEY,
  issue_id   TEXT NOT NULL REFERENCES safety_issues(id) ON DELETE CASCADE,
  actor_id   TEXT,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
               'CREATED','TRIAGED','ASSIGNED','STARTED','NOTE_ADDED',
               'EVIDENCE_UPLOADED','MARKED_FIXED','VERIFIED','CLOSED',
               'REOPENED','ESCALATED')),
  old_status TEXT,
  new_status TEXT,
  note       TEXT,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_me_issue ON maintenance_events(issue_id);

/* ---------------------------------------------------------------- *
 * Student Hostels, Outpass & Digital Passes
 * ---------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS hostels (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  kind        TEXT NOT NULL DEFAULT 'Hostel'
              CHECK (kind IN ('Hostel','Block','Wing')),
  gender      TEXT NOT NULL DEFAULT 'Mixed'
              CHECK (gender IN ('Male','Female','Mixed')),
  capacity    INTEGER,
  warden_id   TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  warden_name TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  notes       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hostel_memberships (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  hostel_id   TEXT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL DEFAULT '',
  approver_id   TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  approver_name TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  assigned_at TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  notes       TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hostel_student_active ON hostel_memberships(student_id) WHERE active = 1;
CREATE INDEX IF NOT EXISTS idx_hm_hostel ON hostel_memberships(hostel_id);

CREATE TABLE IF NOT EXISTS outpass_requests (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name    TEXT NOT NULL,
  student_roll    TEXT NOT NULL,
  hostel_id       TEXT REFERENCES hostels(id) ON DELETE SET NULL,
  hostel_name     TEXT NOT NULL DEFAULT '',
  purpose         TEXT NOT NULL,
  destination     TEXT NOT NULL DEFAULT '',
  emergency_contact TEXT NOT NULL DEFAULT '',
  departure_at    TEXT NOT NULL,
  expected_return_at TEXT,
  notes           TEXT,
  approver_id     TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  approver_name   TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED')),
  decided_at      TEXT,
  decided_by      TEXT,
  rejection_reason TEXT,
  extended_return_at TEXT,
  extension_note     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opr_student  ON outpass_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_opr_status   ON outpass_requests(status);
CREATE INDEX IF NOT EXISTS idx_opr_approver ON outpass_requests(approver_id);

CREATE TABLE IF NOT EXISTS student_passes (
  id              TEXT PRIMARY KEY,
  outpass_id      TEXT NOT NULL UNIQUE REFERENCES outpass_requests(id) ON DELETE CASCADE,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name    TEXT NOT NULL,
  pass_token_hash TEXT NOT NULL UNIQUE,
  valid_from      TEXT NOT NULL,
  valid_until     TEXT NOT NULL,
  state           TEXT NOT NULL DEFAULT 'ACTIVE'
                  CHECK (state IN ('ACTIVE','EXITED','RETURNED','EXPIRED','CANCELLED')),
  issued_by       TEXT NOT NULL DEFAULT 'system',
  issued_at       TEXT NOT NULL,
  cancelled_by    TEXT,
  cancelled_at    TEXT,
  cancellation_note TEXT,
  late_return     INTEGER NOT NULL DEFAULT 0,
  late_alert_sent INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sp_student ON student_passes(student_id);
CREATE INDEX IF NOT EXISTS idx_sp_state   ON student_passes(state);

CREATE TABLE IF NOT EXISTS student_gate_events (
  id              TEXT PRIMARY KEY,
  pass_id         TEXT NOT NULL REFERENCES student_passes(id) ON DELETE CASCADE,
  outpass_id      TEXT NOT NULL REFERENCES outpass_requests(id) ON DELETE CASCADE,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name    TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('EXIT','ENTRY')),
  gate            TEXT NOT NULL,
  scanned_by      TEXT,
  scanned_by_name TEXT NOT NULL DEFAULT '',
  note            TEXT,
  is_override     INTEGER NOT NULL DEFAULT 0,
  override_by     TEXT,
  override_note   TEXT,
  at              TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sge_direction ON student_gate_events(pass_id, direction) WHERE is_override = 0;
CREATE INDEX IF NOT EXISTS idx_sge_student ON student_gate_events(student_id);
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
  {
    table: "visit_requests",
    column: "vehicle_type",
    ddl: "ALTER TABLE visit_requests ADD COLUMN vehicle_type TEXT",
  },
  {
    table: "visit_requests",
    column: "expected_departure_time",
    ddl: "ALTER TABLE visit_requests ADD COLUMN expected_departure_time TEXT",
  },
];
