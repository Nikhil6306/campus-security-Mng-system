-- ---------------------------------------------------------------------------
-- 0014 — Guard Duty Management, Shift Handover, and Digital Patrol Checklist
--
-- Adds:
--   gate_staffing_requirements  — Configured minimum & ideal guard staffing per gate
--   guard_shift_assignments     — Gate-wise scheduled guard shifts
--   guard_shift_sessions        — Actual guard check-in/out shifts
--   patrol_routes               — Campus patrol routes & zones
--   patrol_checkpoints          — Configured route inspection checkpoints
--   patrol_submissions          — Guard checklist submissions during shift
--   shift_handovers             — Formal shift handover state machine
--   shift_handover_items        — Itemized handover review (visitors, incidents, equipment)
-- ---------------------------------------------------------------------------

-- 1. Gate Staffing Requirements
create table if not exists public.gate_staffing_requirements (
  id           text primary key default ('REQ-' || substr(md5(random()::text), 1, 8)),
  gate         text not null,
  shift_type   text not null check (shift_type in ('Morning','Evening','Night','Custom')),
  min_guards   integer not null default 1 check (min_guards >= 1),
  ideal_guards integer not null default 2 check (ideal_guards >= min_guards),
  updated_at   timestamptz not null default now()
);

create unique index if not exists uniq_gate_staffing
  on public.gate_staffing_requirements(gate, shift_type);

-- 2. Guard Shift Duty Assignments
create table if not exists public.guard_shift_assignments (
  id                 text primary key,
  guard_id           text not null references public.security_guards(id) on delete cascade,
  guard_name         text not null,
  gate               text not null,
  duty_date          date not null,
  shift_type         text not null check (shift_type in ('Morning','Evening','Night','Custom')),
  start_time         time not null,
  end_time           time not null,
  is_overnight       boolean not null default false,
  supervisor_id      text,
  supervisor_name    text not null default '',
  status             text not null default 'Scheduled'
                     check (status in ('Scheduled','Active','Completed','Cancelled','Reassigned')),
  reassign_reason    text,
  reassigned_from_id text,
  notes              text,
  created_by         text not null default 'system',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_shift_assignments_guard on public.guard_shift_assignments(guard_id);
create index if not exists idx_shift_assignments_date  on public.guard_shift_assignments(duty_date);
create index if not exists idx_shift_assignments_gate  on public.guard_shift_assignments(gate);
create index if not exists idx_shift_assignments_stat  on public.guard_shift_assignments(status);

-- 3. Guard Shift Sessions (Check-in / Check-out)
create table if not exists public.guard_shift_sessions (
  id             text primary key,
  assignment_id  text not null unique references public.guard_shift_assignments(id) on delete cascade,
  guard_id       text not null,
  guard_name     text not null,
  gate           text not null,
  actual_start   timestamptz not null default now(),
  actual_end     timestamptz,
  checkin_status text not null default 'On-Time'
                 check (checkin_status in ('On-Time','Late','Early')),
  late_minutes   integer not null default 0,
  late_reason    text,
  notes          text,
  status         text not null default 'Active'
                 check (status in ('Active','Handover Pending','Completed','Exception')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_shift_sessions_guard on public.guard_shift_sessions(guard_id);
create index if not exists idx_shift_sessions_stat  on public.guard_shift_sessions(status);

-- 4. Patrol Routes
create table if not exists public.patrol_routes (
  id               text primary key,
  name             text not null unique,
  zone             text not null,
  applicable_gates jsonb not null default '[]'::jsonb,
  frequency_hours  integer not null default 2,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- 5. Patrol Checkpoints
create table if not exists public.patrol_checkpoints (
  id             text primary key,
  route_id       text not null references public.patrol_routes(id) on delete cascade,
  title          text not null,
  location       text not null,
  instructions   text not null default '',
  required_items jsonb not null default '[]'::jsonb,
  order_index    integer not null default 1,
  photo_required boolean not null default false,
  active         boolean not null default true
);

create index if not exists idx_patrol_checkpoints_route on public.patrol_checkpoints(route_id);

-- 6. Patrol Submissions
create table if not exists public.patrol_submissions (
  id               text primary key,
  session_id       text not null references public.guard_shift_sessions(id) on delete cascade,
  checkpoint_id    text not null references public.patrol_checkpoints(id) on delete cascade,
  guard_id         text not null,
  guard_name       text not null,
  status           text not null check (status in ('Pass','Fail','N/A')),
  observations     text not null default '',
  photo_url        text,
  items_checked    jsonb not null default '{}'::jsonb,
  escalated        boolean not null default false,
  escalation_notes text,
  submitted_at     timestamptz not null default now()
);

create index if not exists idx_patrol_subs_session on public.patrol_submissions(session_id);
create index if not exists idx_patrol_subs_chk     on public.patrol_submissions(checkpoint_id);

-- 7. Digital Shift Handovers
create table if not exists public.shift_handovers (
  id                       text primary key,
  session_id               text not null unique references public.guard_shift_sessions(id) on delete cascade,
  outgoing_guard_id        text not null,
  outgoing_guard_name      text not null,
  incoming_guard_id        text,
  incoming_guard_name      text not null default '',
  gate                     text not null,
  duty_date                date not null,
  shift_type               text not null,
  status                   text not null default 'Submitted'
                           check (status in (
                             'Draft','Submitted','Awaiting Incoming Guard','Acknowledged',
                             'Pending Supervisor Review','Approved','Rejected','Exception','Escalated'
                           )),
  equipment_details        jsonb not null default '[]'::jsonb,
  general_notes            text not null default '',
  urgent_issues            text not null default '',
  pending_visitors_count   integer not null default 0,
  open_incidents_count     integer not null default 0,
  patrol_completed_count   integer not null default 0,
  patrol_total_count       integer not null default 0,
  submitted_at             timestamptz,
  incoming_acknowledged_at timestamptz,
  incoming_notes           text,
  disputed_items           text,
  supervisor_id            text,
  supervisor_name          text,
  supervisor_decision      text,
  supervisor_notes         text,
  rejection_reason         text,
  decided_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_shift_handovers_stat on public.shift_handovers(status);
create index if not exists idx_shift_handovers_date on public.shift_handovers(duty_date);
create index if not exists idx_shift_handovers_gate on public.shift_handovers(gate);

-- 8. Shift Handover Items
create table if not exists public.shift_handover_items (
  id                       text primary key default ('HI-' || substr(md5(random()::text), 1, 10)),
  handover_id              text not null references public.shift_handovers(id) on delete cascade,
  category                 text not null check (category in ('Visitor','Incident','Equipment','Patrol')),
  reference_id             text not null,
  title                    text not null,
  severity_or_status       text not null default '',
  notes                    text not null default '',
  acknowledged_by_incoming boolean not null default false,
  created_at               timestamptz not null default now()
);

create index if not exists idx_handover_items_parent on public.shift_handover_items(handover_id);

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ---------------------------------------------------------------------------

alter table public.gate_staffing_requirements enable row level security;
alter table public.guard_shift_assignments    enable row level security;
alter table public.guard_shift_sessions       enable row level security;
alter table public.patrol_routes              enable row level security;
alter table public.patrol_checkpoints         enable row level security;
alter table public.patrol_submissions         enable row level security;
alter table public.shift_handovers            enable row level security;
alter table public.shift_handover_items       enable row level security;

-- Read policies: Staff & Admins can read
create policy staffing_read on public.gate_staffing_requirements for select using (true);
create policy staffing_admin_write on public.gate_staffing_requirements for all using (public.is_admin()) with check (public.is_admin());

create policy assignments_read on public.guard_shift_assignments for select using (true);
create policy assignments_admin_write on public.guard_shift_assignments for all using (public.is_admin()) with check (public.is_admin());

create policy sessions_read on public.guard_shift_sessions for select using (true);
create policy sessions_write on public.guard_shift_sessions for all using (
  public.is_admin() or public.current_role_name() = 'security'
) with check (
  public.is_admin() or public.current_role_name() = 'security'
);

create policy patrol_routes_read on public.patrol_routes for select using (true);
create policy patrol_routes_admin on public.patrol_routes for all using (public.is_admin()) with check (public.is_admin());

create policy patrol_checkpoints_read on public.patrol_checkpoints for select using (true);
create policy patrol_checkpoints_admin on public.patrol_checkpoints for all using (public.is_admin()) with check (public.is_admin());

create policy patrol_subs_read on public.patrol_submissions for select using (true);
create policy patrol_subs_write on public.patrol_submissions for all using (
  public.is_admin() or public.current_role_name() = 'security'
) with check (
  public.is_admin() or public.current_role_name() = 'security'
);

create policy handovers_read on public.shift_handovers for select using (true);
create policy handovers_write on public.shift_handovers for all using (
  public.is_admin() or public.current_role_name() = 'security'
) with check (
  public.is_admin() or public.current_role_name() = 'security'
);

create policy handover_items_read on public.shift_handover_items for select using (true);
create policy handover_items_write on public.shift_handover_items for all using (
  public.is_admin() or public.current_role_name() = 'security'
) with check (
  public.is_admin() or public.current_role_name() = 'security'
);
