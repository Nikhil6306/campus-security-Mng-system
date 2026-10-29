-- ---------------------------------------------------------------------------
-- 0010 — Guard Dashboard, Duty Schedules, Registration Approvals
--
-- Adds:
--   guard_duty_schedules  — per-guard weekly schedule (admin-managed)
--   guard_registrations   — pending guard signup requests (admin approval)
--
-- Apply after 0009_auth_profiles_and_roles.sql.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Guard duty schedule
--
-- One row per guard per calendar day.  Admins write it; guards read their own.
-- ---------------------------------------------------------------------------

create table if not exists public.guard_duty_schedules (
  id              uuid primary key default gen_random_uuid(),
  guard_id        text not null references public.security_guards(id) on delete cascade,
  schedule_date   date not null,
  shift_type      text not null check (shift_type in ('Morning','Evening','Night','General','Day Off')),
  duty_start      time,
  duty_end        time,
  location        text not null default '',
  supervisor_name text not null default '',
  status          text not null default 'Scheduled'
                  check (status in ('Scheduled','In Progress','Completed','Cancelled','Day Off')),
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists uniq_guard_schedule_date
  on public.guard_duty_schedules(guard_id, schedule_date);

create index if not exists idx_guard_schedules_guard on public.guard_duty_schedules(guard_id);
create index if not exists idx_guard_schedules_date  on public.guard_duty_schedules(schedule_date);

-- ---------------------------------------------------------------------------
-- Guard registration requests
--
-- When a new security guard signs up they land here as Pending.
-- An admin approves → the profiles row is activated and the guard_id linked.
-- ---------------------------------------------------------------------------

create table if not exists public.guard_registrations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  full_name         text not null,
  email             text not null,
  phone             text not null default '',
  employee_id       text not null default '',
  address           text not null default '',
  emergency_contact text not null default '',
  joining_date      date,
  shift             text not null default 'Morning'
                    check (shift in ('Morning','Evening','Night','General')),
  assigned_gate     text not null default '',
  notes             text,
  status            text not null default 'Pending'
                    check (status in ('Pending','Approved','Rejected')),
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  admin_remarks     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_guard_reg_status on public.guard_registrations(status);
create index if not exists idx_guard_reg_user   on public.guard_registrations(user_id);

-- ---------------------------------------------------------------------------
-- RLS — guard_duty_schedules
--
-- Guards may read their own rows.
-- Admins have full access.
-- ---------------------------------------------------------------------------

alter table public.guard_duty_schedules enable row level security;

drop policy if exists guard_schedule_self_read on public.guard_duty_schedules;
create policy guard_schedule_self_read on public.guard_duty_schedules
  for select using (
    public.is_admin()
    or (
      public.current_role_name() = 'security'
      and guard_id = public.current_ref_id()
    )
  );

drop policy if exists guard_schedule_admin_write on public.guard_duty_schedules;
create policy guard_schedule_admin_write on public.guard_duty_schedules
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS — guard_registrations
--
-- A guard may read their own registration row.
-- Admins have full access.
-- The insert policy allows the authenticated user to create their own request.
-- ---------------------------------------------------------------------------

alter table public.guard_registrations enable row level security;

drop policy if exists guard_reg_self_read on public.guard_registrations;
create policy guard_reg_self_read on public.guard_registrations
  for select using (
    public.is_admin()
    or user_id = auth.uid()
  );

drop policy if exists guard_reg_self_insert on public.guard_registrations;
create policy guard_reg_self_insert on public.guard_registrations
  for insert with check (user_id = auth.uid());

drop policy if exists guard_reg_admin_write on public.guard_registrations;
create policy guard_reg_admin_write on public.guard_registrations
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists guard_reg_admin_delete on public.guard_registrations;
create policy guard_reg_admin_delete on public.guard_registrations
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Add supervisor_id column to security_guards (nullable)
-- ---------------------------------------------------------------------------

alter table public.security_guards
  add column if not exists supervisor_id text references public.security_guards(id) on delete set null;

alter table public.security_guards
  add column if not exists supervisor_name text not null default '';

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.guard_duty_schedules;
    alter publication supabase_realtime add table public.guard_registrations;
  end if;
exception when duplicate_object then null;
end $$;
