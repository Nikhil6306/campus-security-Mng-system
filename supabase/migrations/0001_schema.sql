-- ---------------------------------------------------------------------------
-- Campus Security Management System — PostgreSQL / Supabase schema
--
-- The same relational model the application runs on, expressed in PostgreSQL.
-- Row Level Security lives in the companion migration `0002_rls.sql`; apply
-- this file first.
--
--   supabase db push
--   -- or: psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_schema.sql
--
-- Conventions
--   * Identity rows key on `auth.users` so Supabase Auth owns credentials —
--     this schema stores no password material of its own.
--   * Operational records keep their human-readable references
--     (`DSVV-VIS-2026-000124`, `GRD-003`) because security staff read and quote
--     them out loud at the gate. Surrogate UUIDs sit alongside where a stable
--     machine key is useful.
--   * `timestamptz` throughout; dates are `date`, clock times `time`.
--   * Every lifecycle column carries a CHECK constraint so an invalid status
--     cannot be written even from a direct SQL client.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

do $$ begin
  create type app_role as enum ('super_admin', 'admin', 'security', 'teacher', 'student');
exception when duplicate_object then null;
end $$;

/* One row per signed-in person, keyed to Supabase Auth.

   `ref_id` links the account to its operational record — a teacher row, a guard
   row, a student row — which is what the RLS policies below use to answer
   "is this the caller's own data?". */
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  role        app_role not null default 'student',
  ref_id      text,
  gate        text,
  active      boolean not null default true,
  last_login_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_ref on public.profiles(ref_id);

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------

create table if not exists public.departments (
  id         text primary key,
  name       text not null unique,
  code       text not null,
  head       text not null default '',
  location   text not null default '',
  phone      text not null default '',
  email      text not null default '',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id                  text primary key,
  employee_id         text not null unique,
  name                text not null,
  email               text not null,
  phone               text not null,
  department_id       text references public.departments(id) on delete set null,
  designation         text not null default '',
  photo_url           text,
  room                text not null default '',
  availability_status text not null default 'Available'
                      check (availability_status in ('Available','Busy','On Leave','Unavailable')),
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_teachers_department on public.teachers(department_id);

create table if not exists public.teacher_availability (
  teacher_id   text primary key references public.teachers(id) on delete cascade,
  days         integer[] not null default '{1,2,3,4,5}',
  start_time   time not null default '09:00',
  end_time     time not null default '17:00',
  slot_minutes integer not null default 30 check (slot_minutes between 10 and 240),
  blocked      date[] not null default '{}',
  updated_at   timestamptz not null default now()
);

create table if not exists public.campus_gates (
  id     text primary key,
  name   text not null unique,
  kind   text not null default 'Gate' check (kind in ('Gate','Block','Hostel','Facility')),
  active boolean not null default true
);

create table if not exists public.security_guards (
  id                text primary key,
  employee_id       text not null unique,
  full_name         text not null,
  phone             text not null,
  email             text not null default '',
  photo_url         text,
  shift             text not null check (shift in ('Morning','Evening','Night','General')),
  shift_start       time not null,
  shift_end         time not null,
  assigned_gate     text not null references public.campus_gates(name) on update cascade,
  status            text not null check (status in ('Active','On Duty','Off Duty','On Leave','Suspended')),
  joining_date      date not null,
  emergency_contact text not null default '',
  address           text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_guards_status on public.security_guards(status);
create index if not exists idx_guards_gate on public.security_guards(assigned_gate);

create table if not exists public.students (
  id             text primary key,
  name           text not null,
  roll_no        text not null unique,
  department_id  text references public.departments(id) on delete set null,
  year           text not null default '',
  hostel         text not null default '',
  room           text not null default '',
  guardian_name  text not null default '',
  guardian_phone text not null default '',
  on_campus      boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Visitors and bookings
-- ---------------------------------------------------------------------------

create table if not exists public.visitors (
  id                    text primary key,
  full_name             text not null,
  mobile                text not null unique,
  email                 text not null default '',
  gender                text not null default 'Prefer not to say',
  id_type               text not null default 'Aadhaar Card',
  id_number             text not null default '',
  photo_url             text,
  organization          text not null default '',
  address               text not null default '',
  emergency_contact     text not null default '',
  whatsapp_country_code text not null default '+91',
  whatsapp_number       text not null default '',
  visitor_type          text not null default 'Guest',
  total_visits          integer not null default 0,
  blacklisted           boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_visitors_name on public.visitors(full_name);

/* The central record of the system: visit details, the approval decision and
   the gate check-in / check-out stamps. */
create table if not exists public.visit_requests (
  id                    text primary key,
  visitor_id            text not null references public.visitors(id) on delete cascade,
  full_name             text not null,
  mobile                text not null,
  email                 text not null default '',
  gender                text not null default 'Prefer not to say',
  organization          text not null default '',
  address               text not null default '',
  emergency_contact     text not null default '',
  whatsapp_country_code text not null default '+91',
  whatsapp_number       text not null default '',
  visitor_type          text not null,
  id_type               text not null,
  id_number             text not null,
  photo_url             text,
  purpose               text not null,
  purpose_detail        text,
  host_id               text references public.teachers(id) on delete set null,
  host_name             text not null default '',
  department_id         text references public.departments(id) on delete set null,
  department            text not null default '',
  visit_date            date not null,
  visit_time            time not null,
  expected_duration     text not null default '30 minutes',
  number_of_visitors    integer not null default 1 check (number_of_visitors > 0),
  vehicle_required      boolean not null default false,
  vehicle_number        text,
  notes                 text,
  special_requirements  text,
  status                text not null check (status in (
                          'Pending','Approved','Rejected','Rescheduled','Cancelled',
                          'Checked In','Meeting In Progress','Checked Out','No Show','Expired')),
  source                text not null default 'Visitor Portal',
  pass_token            text unique,
  badge_number          text,
  decided_at            timestamptz,
  decided_by            text,
  rejection_reason      text,
  rescheduled_from      text,
  check_in_at           timestamptz,
  checked_in_by         text,
  check_out_at          timestamptz,
  checked_out_by        text,
  meeting_started_at    timestamptz,
  meeting_ended_at      timestamptz,
  gate                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_visits_status on public.visit_requests(status);
create index if not exists idx_visits_date on public.visit_requests(visit_date);
create index if not exists idx_visits_host on public.visit_requests(host_id);
create index if not exists idx_visits_mobile on public.visit_requests(mobile);
create index if not exists idx_visits_visitor on public.visit_requests(visitor_id);

/* One live booking per host slot. The partial index ignores the closed
   lifecycle states so a rejected slot can be rebooked. */
create unique index if not exists uniq_host_slot
  on public.visit_requests(host_id, visit_date, visit_time)
  where host_id is not null
    and status in ('Pending','Approved','Rescheduled','Checked In','Meeting In Progress');

/* The same visitor cannot hold two live bookings for the same date and time. */
create unique index if not exists uniq_visitor_slot
  on public.visit_requests(visitor_id, visit_date, visit_time)
  where status in ('Pending','Approved','Rescheduled','Checked In','Meeting In Progress');

-- ---------------------------------------------------------------------------
-- Gate movement
-- ---------------------------------------------------------------------------

create table if not exists public.check_logs (
  id               text primary key,
  visit_request_id text not null references public.visit_requests(id) on delete cascade,
  visitor_id       text not null references public.visitors(id) on delete cascade,
  visitor_name     text not null,
  direction        text not null check (direction in ('In','Out')),
  gate             text not null,
  guard_id         text references public.security_guards(id) on delete set null,
  guard_name       text not null default '',
  note             text,
  at               timestamptz not null default now()
);
create index if not exists idx_check_logs_visit on public.check_logs(visit_request_id);
create index if not exists idx_check_logs_guard on public.check_logs(guard_id);
create index if not exists idx_check_logs_at on public.check_logs(at);

/* A booking may only be stamped once per direction — the gate cannot create
   duplicate check-in records even under a double-tap or a replayed request. */
create unique index if not exists uniq_check_direction
  on public.check_logs(visit_request_id, direction);

create table if not exists public.vehicles (
  id              text primary key,
  vehicle_number  text not null,
  vehicle_type    text not null,
  visitor_name    text not null default '',
  driver_name     text not null default '',
  purpose         text not null default '',
  gate            text not null,
  entry_time      timestamptz not null default now(),
  exit_time       timestamptz,
  status          text not null check (status in ('Inside','Exited')),
  linked_visit_id text references public.visit_requests(id) on delete set null,
  guard_id        text references public.security_guards(id) on delete set null,
  guard_name      text not null default ''
);
create index if not exists idx_vehicles_status on public.vehicles(status);
create index if not exists idx_vehicles_number on public.vehicles(vehicle_number);

/* A number plate can only be inside the campus once at a time. */
create unique index if not exists uniq_vehicle_inside
  on public.vehicles(vehicle_number) where status = 'Inside';

create table if not exists public.outings (
  id                text primary key,
  student_id        text not null references public.students(id) on delete cascade,
  student_name      text not null,
  type              text not null,
  reason            text not null default '',
  from_date         date not null,
  to_date           date not null,
  guardian_approved boolean not null default false,
  status            text not null check (status in ('Pending','Approved','Rejected','Completed')),
  decided_by        text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_outings_status on public.outings(status);

create table if not exists public.movements (
  id          text primary key,
  person_id   text not null,
  person_name text not null,
  person_type text not null check (person_type in ('Student','Visitor','Staff')),
  direction   text not null check (direction in ('Entry','Exit')),
  gate        text not null,
  at          timestamptz not null default now()
);
create index if not exists idx_movements_at on public.movements(at);

-- ---------------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------------

create table if not exists public.incidents (
  id              text primary key,
  type            text not null,
  title           text not null,
  location        text not null,
  date            date not null,
  time            time not null,
  severity        text not null check (severity in ('Low','Medium','High','Critical')),
  description     text not null default '',
  reported_by     text not null default '',
  reported_by_id  text references public.security_guards(id) on delete set null,
  assigned_to_id  text references public.security_guards(id) on delete set null,
  assigned_to_name text,
  attachment_url  text,
  status          text not null check (status in ('Open','Investigating','Resolved','Closed')),
  resolution_note text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_incidents_status on public.incidents(status);
create index if not exists idx_incidents_severity on public.incidents(severity);

create table if not exists public.emergencies (
  id               text primary key,
  type             text not null check (type in (
                     'Security Emergency','Medical Emergency','Fire Emergency',
                     'Evacuation','Suspicious Activity')),
  severity         text not null check (severity in ('Low','Medium','High','Critical')),
  location         text not null,
  note             text,
  triggered_by     text not null default '',
  triggered_by_id  text,
  triggered_at     timestamptz not null default now(),
  status           text not null check (status in ('Active','Acknowledged','Resolved')),
  acknowledged_at  timestamptz,
  acknowledged_by  text,
  resolved_at      timestamptz
);
create index if not exists idx_emergencies_status on public.emergencies(status);

-- ---------------------------------------------------------------------------
-- Notifications, WhatsApp, audit and configuration
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id       text primary key,
  type     text not null,
  title    text not null,
  message  text not null,
  href     text,
  audience text,
  read     boolean not null default false,
  at       timestamptz not null default now()
);
create index if not exists idx_notifications_at on public.notifications(at);
create index if not exists idx_notifications_read on public.notifications(read);

/* One row per outbound WhatsApp message.

   The dedupe_key is what makes a retry safe: the send path writes the row first
   and only then talks to the provider, so a replayed request collides on the
   unique constraint instead of sending the visitor a second copy. */
create table if not exists public.whatsapp_messages (
  id                  text primary key,
  booking_id          text references public.visit_requests(id) on delete cascade,
  visitor_id          text references public.visitors(id) on delete set null,
  phone_number        text not null,
  message_type        text not null,
  dedupe_key          text not null unique,
  body                text not null default '',
  provider            text not null default 'mock',
  provider_message_id text,
  status              text not null check (status in ('QUEUED','SENT','DELIVERED','READ','FAILED')),
  attempts            integer not null default 0,
  error_message       text,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  read_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_whatsapp_booking on public.whatsapp_messages(booking_id);
create index if not exists idx_whatsapp_status on public.whatsapp_messages(status);
create index if not exists idx_whatsapp_created on public.whatsapp_messages(created_at);

create table if not exists public.activity_logs (
  id         text primary key,
  actor_id   text,
  actor_name text not null,
  actor_role text not null,
  action     text not null,
  entity     text not null,
  entity_id  text not null,
  summary    text not null,
  channel    text not null default 'web',
  at         timestamptz not null default now()
);
create index if not exists idx_activity_at on public.activity_logs(at);
create index if not exists idx_activity_entity on public.activity_logs(entity, entity_id);

create table if not exists public.campus_settings (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Realtime
--
-- Supabase Realtime streams these tables to the console so a check-in at the
-- gate reaches the dashboard without a refresh.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.visit_requests;
    alter publication supabase_realtime add table public.check_logs;
    alter publication supabase_realtime add table public.incidents;
    alter publication supabase_realtime add table public.emergencies;
    alter publication supabase_realtime add table public.notifications;
    alter publication supabase_realtime add table public.activity_logs;
  end if;
exception when duplicate_object then null;
end $$;
