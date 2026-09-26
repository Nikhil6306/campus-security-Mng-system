-- ---------------------------------------------------------------------------
-- 0004 — faculty visit notifications and visitor pass expiry
--
-- PostgreSQL / Supabase parity for `lib/server/schema.ts`. Apply after 0003.
-- ---------------------------------------------------------------------------

-- The number a faculty member receives visit requests on. Kept separate from
-- `phone`, which may be a desk extension. Never exposed to unauthenticated
-- callers: the public host directory returns name, department and designation
-- only (see the policy below).
alter table public.teachers
  add column if not exists whatsapp_number text not null default '';

-- When a visitor pass stops being admissible at the gate. Derived from the
-- visit slot plus the campus grace window, so a pass is never valid forever.
alter table public.visit_requests
  add column if not exists pass_expires_at timestamptz;

create index if not exists idx_visits_pass_expiry
  on public.visit_requests(pass_expires_at)
  where pass_expires_at is not null;

-- ---------------------------------------------------------------------------
-- Faculty contact privacy
--
-- The visitor-facing host picker needs name, department, designation and
-- availability — never a phone number, WhatsApp number or email address. This
-- view is what an anonymous client may read; the base table stays closed.
-- ---------------------------------------------------------------------------

create or replace view public.public_hosts as
  select
    t.id,
    t.name,
    t.department_id,
    t.designation,
    t.availability_status,
    t.active
  from public.teachers t
  where t.active;

-- `security_invoker` keeps the view subject to the caller's own policies on
-- any table it touches, rather than running as its definer.
alter view public.public_hosts set (security_invoker = on);

grant select on public.public_hosts to anon, authenticated;

drop policy if exists teachers_public_directory on public.teachers;
create policy teachers_public_directory on public.teachers
  for select using (active);

comment on column public.teachers.whatsapp_number is
  'Faculty WhatsApp number for visit-request notifications. Server-side use only.';
comment on column public.visit_requests.pass_expires_at is
  'Visitor pass validity cut-off. NULL means the pass predates expiry tracking.';
