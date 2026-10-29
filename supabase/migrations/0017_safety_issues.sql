-- ---------------------------------------------------------------------------
-- 0017 — Safety Issues & Maintenance Workflow
--
-- Adds:
--   safety_issues        — Defect/hazard reports with full SLA lifecycle
--   maintenance_assignments — Task assignment to maintenance personnel
--   maintenance_events   — Immutable history of every workflow transition
-- ---------------------------------------------------------------------------

-- 1. Safety issue reports
create table if not exists public.safety_issues (
  id          text primary key,

  -- Classification
  category    text not null check (category in (
                'Broken Gate/Door Lock','Damaged CCTV','Faulty Security Light',
                'Blocked Fire Exit','Missing/Damaged Fire Extinguisher',
                'Unsafe Electrical Condition','Damaged Boundary/Access Barrier',
                'Other Campus Safety Issue')),
  title       text not null,
  description text not null default '',

  -- Location
  campus      text not null default 'Main Campus',
  building    text not null default '',
  area        text not null default '',

  -- Priority
  severity    text not null default 'Medium'
              check (severity in ('Low','Medium','High','Critical')),
  urgency     text not null default 'Normal'
              check (urgency in ('Routine','Normal','Urgent','Immediate')),

  -- Reporter
  reporter_id   text,
  reporter_name text not null,
  reporter_role text not null default 'security',

  -- Evidence
  evidence_url  text,

  -- Assignment
  assigned_to_id   text,            -- maintenance person/team
  assigned_to_name text,
  assigned_at      timestamptz,
  deadline_at      timestamptz,     -- computed from severity + SLA policy

  -- Status machine
  status      text not null default 'REPORTED'
              check (status in (
                'REPORTED','TRIAGED','ASSIGNED','IN_PROGRESS',
                'FIXED','VERIFIED','CLOSED','REOPENED','ESCALATED')),

  -- Verification
  verified_by   text,
  verified_at   timestamptz,
  fix_notes     text,              -- what was done to fix it
  evidence_fix_url text,           -- photo of fixed state

  -- Closure
  closed_at     timestamptz,
  closure_note  text,

  -- Recurrence tracking
  parent_issue_id text references public.safety_issues(id) on delete set null,
  reopen_count    integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_si_status   on public.safety_issues(status);
create index if not exists idx_si_severity on public.safety_issues(severity);
create index if not exists idx_si_building on public.safety_issues(building);
create index if not exists idx_si_created  on public.safety_issues(created_at);

-- 2. Maintenance assignment history
create table if not exists public.maintenance_assignments (
  id            text primary key,
  issue_id      text not null references public.safety_issues(id) on delete cascade,
  assignee_id   text,
  assignee_name text not null,
  assigned_by   text not null,
  assigned_at   timestamptz not null default now(),
  deadline_at   timestamptz,
  notes         text,
  active        boolean not null default true
);

create index if not exists idx_ma_issue on public.maintenance_assignments(issue_id);
-- Only one active assignment per issue
create unique index if not exists uniq_ma_active
  on public.maintenance_assignments(issue_id)
  where active = true;

-- 3. Immutable maintenance event log
create table if not exists public.maintenance_events (
  id         text primary key,
  issue_id   text not null references public.safety_issues(id) on delete cascade,
  actor_id   text,
  actor_name text not null,
  actor_role text not null,
  event_type text not null check (event_type in (
               'CREATED','TRIAGED','ASSIGNED','STARTED','NOTE_ADDED',
               'EVIDENCE_UPLOADED','MARKED_FIXED','VERIFIED','CLOSED',
               'REOPENED','ESCALATED')),
  old_status text,
  new_status text,
  note       text,
  at         timestamptz not null default now()
);

create index if not exists idx_me_issue on public.maintenance_events(issue_id);
create index if not exists idx_me_at    on public.maintenance_events(at);

-- 4. RLS
alter table public.safety_issues          enable row level security;
alter table public.maintenance_assignments enable row level security;
alter table public.maintenance_events      enable row level security;

-- Admin: full access
create policy si_admin on public.safety_issues for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active
  ));

create policy ma_admin on public.maintenance_assignments for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active
  ));

create policy me_admin on public.maintenance_events for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active
  ));

-- Guards: can create reports and read/update their own reports
create policy si_guard_insert on public.safety_issues for insert
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('security','admin','super_admin') and p.active
  ));

create policy si_guard_read on public.safety_issues for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('security','admin','super_admin') and p.active
  ));

create policy si_guard_update on public.safety_issues for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('security','admin','super_admin')
      and p.active
      -- guards can update issues they reported or are assigned to
      and (reporter_id = auth.uid()::text or assigned_to_id = p.ref_id)
  ));

create policy ma_guard_read on public.maintenance_assignments for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('security','admin','super_admin') and p.active
  ));

create policy me_guard_read on public.maintenance_events for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('security','admin','super_admin') and p.active
  ));

create policy me_guard_insert on public.maintenance_events for insert
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('security','admin','super_admin') and p.active
  ));

-- 5. Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.safety_issues;
    alter publication supabase_realtime add table public.maintenance_events;
  end if;
exception when duplicate_object then null;
end $$;
