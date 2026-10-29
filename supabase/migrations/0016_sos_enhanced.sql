-- ---------------------------------------------------------------------------
-- 0016 — Enhanced Emergency SOS + Guard Dispatch + Incident Lifecycle
--
-- Adds:
--   emergency_incidents  — Full-lifecycle SOS incidents (replaces/extends emergencies)
--   incident_assignments — Guard dispatch records with timing
--   incident_events      — Immutable audit trail for every status transition
-- ---------------------------------------------------------------------------

-- 1. Full-lifecycle emergency incidents
create table if not exists public.emergency_incidents (
  id               text primary key,
  -- Reporter
  reporter_id      text,                         -- auth.users.id when authenticated
  reporter_name    text not null,
  reporter_role    text not null default 'security',
  reporter_contact text not null default '',

  -- Classification
  category         text not null check (category in (
                     'Medical Emergency','Fire or Smoke','Security Threat',
                     'Suspicious Activity','Accident or Injury','Other Emergency')),
  severity         text not null check (severity in ('Low','Medium','High','Critical')),
  title            text not null default '',
  description      text not null default '',

  -- Location
  campus           text not null default 'Main Campus',
  building         text not null default '',
  area             text not null default '',
  -- Coordinates only stored when user explicitly grants permission
  latitude         numeric(10,7),
  longitude        numeric(10,7),

  -- Evidence
  evidence_url     text,                         -- path in private Supabase Storage

  -- Status machine
  status           text not null default 'REPORTED'
                   check (status in (
                     'REPORTED','ACKNOWLEDGED','ASSIGNED','RESPONDING',
                     'ON_SCENE','RESOLVED','CLOSED','CANCELLED','ESCALATED')),

  -- Assigned responder (denormalised for fast reads)
  assigned_guard_id   text references public.security_guards(id) on delete set null,
  assigned_guard_name text,
  assigned_at         timestamptz,

  -- Timing (server-side only)
  reported_at       timestamptz not null default now(),
  acknowledged_at   timestamptz,
  dispatched_at     timestamptz,
  responding_at     timestamptz,
  on_scene_at       timestamptz,
  resolved_at       timestamptz,
  closed_at         timestamptz,

  -- Resolution
  resolution_summary text,
  resolved_by        text,

  -- Escalation control
  ack_deadline_at    timestamptz,               -- auto-computed; NULL until dispatched
  escalated          boolean not null default false,
  escalation_note    text,

  -- Idempotency (client submits a client_key; server deduplicates)
  idempotency_key  text unique,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_ei_status   on public.emergency_incidents(status);
create index if not exists idx_ei_severity on public.emergency_incidents(severity);
create index if not exists idx_ei_guard    on public.emergency_incidents(assigned_guard_id);
create index if not exists idx_ei_reported on public.emergency_incidents(reported_at);

-- 2. Guard dispatch assignments (one per incident, reassignment creates a new row)
create table if not exists public.incident_assignments (
  id            text primary key,
  incident_id   text not null references public.emergency_incidents(id) on delete cascade,
  guard_id      text not null references public.security_guards(id) on delete cascade,
  guard_name    text not null,
  assigned_by   text not null,                  -- dispatcher name
  assigned_at   timestamptz not null default now(),
  reason        text,                           -- reason for reassignment if applicable
  active        boolean not null default true   -- only one active assignment per incident
);

create index if not exists idx_ia_incident on public.incident_assignments(incident_id);
create index if not exists idx_ia_guard    on public.incident_assignments(guard_id);
-- Only one active assignment per incident
create unique index if not exists uniq_ia_active
  on public.incident_assignments(incident_id)
  where active = true;

-- 3. Immutable event log (every transition + guard action)
create table if not exists public.incident_events (
  id          text primary key,
  incident_id text not null references public.emergency_incidents(id) on delete cascade,
  actor_id    text,
  actor_name  text not null,
  actor_role  text not null,
  event_type  text not null check (event_type in (
                'CREATED','STATUS_CHANGED','ASSIGNED','REASSIGNED','NOTE_ADDED',
                'EVIDENCE_UPLOADED','BACKUP_REQUESTED','ESCALATED','CLOSED')),
  old_status  text,
  new_status  text,
  note        text,
  at          timestamptz not null default now()
);

create index if not exists idx_iev_incident on public.incident_events(incident_id);
create index if not exists idx_iev_at       on public.incident_events(at);

-- 4. Row Level Security
alter table public.emergency_incidents enable row level security;
alter table public.incident_assignments enable row level security;
alter table public.incident_events      enable row level security;

-- Admin: full access
create policy ei_admin on public.emergency_incidents for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active
  ));

create policy ia_admin on public.incident_assignments for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active
  ));

create policy iev_admin on public.incident_events for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active
  ));

-- Security guards: insert SOS + read/update assigned incidents
create policy ei_guard_insert on public.emergency_incidents for insert
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'security' and p.active
  ));

create policy ei_guard_read on public.emergency_incidents for select
  using (exists (
    select 1 from public.profiles p
    join public.security_guards g on g.id = p.ref_id
    where p.id = auth.uid() and p.role = 'security' and p.active
  ));

create policy ei_guard_update on public.emergency_incidents for update
  using (exists (
    select 1 from public.profiles p
    join public.security_guards g on g.id = p.ref_id
    where p.id = auth.uid()
      and p.role = 'security'
      and p.active
      and (
        -- assigned guard can update their own incidents
        g.id = assigned_guard_id
        -- or the reporting guard can update unassigned incidents they created
        or (reporter_id = auth.uid()::text and assigned_guard_id is null)
      )
  ));

create policy ia_guard_read on public.incident_assignments for select
  using (exists (
    select 1 from public.profiles p
    join public.security_guards g on g.id = p.ref_id
    where p.id = auth.uid() and p.role = 'security' and p.active and g.id = guard_id
  ));

create policy iev_guard_read on public.incident_events for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','admin','security') and p.active
  ));

create policy iev_guard_insert on public.incident_events for insert
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','admin','security') and p.active
  ));

-- 5. Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.emergency_incidents;
    alter publication supabase_realtime add table public.incident_assignments;
    alter publication supabase_realtime add table public.incident_events;
  end if;
exception when duplicate_object then null;
end $$;
