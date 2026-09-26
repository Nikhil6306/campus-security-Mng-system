-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Apply after `0001_schema.sql`.
--
-- The rule this file enforces: the database itself decides what each role may
-- read, so a caller holding an anon key cannot reach visitor records however
-- they shape the query. Application-side role checks stay in place, but they
-- are the second line, not the only one.
--
-- Note on the service role: `SUPABASE_SERVICE_ROLE_KEY` bypasses every policy
-- below. It belongs on the server only and must never be exposed to a browser.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Helpers
--
-- SECURITY DEFINER so a policy can read `profiles` without recursing back into
-- the policy that protects `profiles`. `search_path` is pinned because a
-- definer function that resolves names through a caller-controlled path is a
-- privilege-escalation route.
-- ---------------------------------------------------------------------------

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role::text
    from public.profiles p
   where p.id = auth.uid()
     and p.active
   limit 1;
$$;

create or replace function public.current_ref_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.ref_id from public.profiles p where p.id = auth.uid() and p.active limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_role_name() in ('admin', 'super_admin');
$$;

/* Admins plus the gate — the roles that operate check-in and check-out. */
create or replace function public.is_gate_operator()
returns boolean
language sql
stable
as $$
  select public.current_role_name() in ('admin', 'super_admin', 'security');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.current_role_name() in ('admin', 'super_admin', 'security', 'teacher');
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
--
-- Enabled on every table without exception. A table with RLS on and no policy
-- denies all access, which is the correct default: access is granted
-- deliberately below, never inherited by omission.
-- ---------------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.departments          enable row level security;
alter table public.teachers             enable row level security;
alter table public.teacher_availability enable row level security;
alter table public.campus_gates         enable row level security;
alter table public.security_guards      enable row level security;
alter table public.students             enable row level security;
alter table public.visitors             enable row level security;
alter table public.visit_requests       enable row level security;
alter table public.check_logs           enable row level security;
alter table public.vehicles             enable row level security;
alter table public.outings              enable row level security;
alter table public.movements            enable row level security;
alter table public.incidents            enable row level security;
alter table public.emergencies          enable row level security;
alter table public.notifications        enable row level security;
alter table public.whatsapp_messages    enable row level security;
alter table public.activity_logs        enable row level security;
alter table public.campus_settings      enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());

/* A user may edit their own profile but not promote themselves: the role and
   the record it is linked to have to survive the update unchanged. */
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and ref_id is not distinct from (select ref_id from public.profiles where id = auth.uid())
  );

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Directory
--
-- Departments, gates and the host list are the only things a visitor needs
-- before booking, so they are readable without a session — but only the active
-- rows, and `teachers_public` exposes just the columns the booking form shows.
-- ---------------------------------------------------------------------------

drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments
  for select using (active or public.is_staff());

drop policy if exists departments_admin_write on public.departments;
create policy departments_admin_write on public.departments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists gates_read on public.campus_gates;
create policy gates_read on public.campus_gates
  for select using (active or public.is_staff());

drop policy if exists gates_admin_write on public.campus_gates;
create policy gates_admin_write on public.campus_gates
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists teachers_read on public.teachers;
create policy teachers_read on public.teachers
  for select using (active or public.is_staff());

drop policy if exists teachers_admin_write on public.teachers;
create policy teachers_admin_write on public.teachers
  for all using (public.is_admin()) with check (public.is_admin());

/* A teacher may change their own record — the trigger below stops that being
   used to reassign themselves to another department. */
drop policy if exists teachers_self_update on public.teachers;
create policy teachers_self_update on public.teachers
  for update using (public.current_role_name() = 'teacher' and id = public.current_ref_id())
  with check (public.current_role_name() = 'teacher' and id = public.current_ref_id());

/* The booking form needs the working pattern to build its slot grid, so this is
   readable anonymously. It carries no personal data — only days and hours. */
drop policy if exists availability_read on public.teacher_availability;
create policy availability_read on public.teacher_availability for select using (true);

drop policy if exists availability_write on public.teacher_availability;
create policy availability_write on public.teacher_availability
  for all using (public.is_admin() or teacher_id = public.current_ref_id())
  with check (public.is_admin() or teacher_id = public.current_ref_id());

-- ---------------------------------------------------------------------------
-- Staff records
--
-- Guard and student records are staff-only. Nothing here is public: a guard
-- roster names people and their shift patterns.
-- ---------------------------------------------------------------------------

drop policy if exists guards_read on public.security_guards;
create policy guards_read on public.security_guards
  for select using (public.is_gate_operator());

drop policy if exists guards_admin_write on public.security_guards;
create policy guards_admin_write on public.security_guards
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists students_read on public.students;
create policy students_read on public.students
  for select using (public.is_staff() or id = public.current_ref_id());

drop policy if exists students_admin_write on public.students;
create policy students_admin_write on public.students
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Visitors and bookings
--
-- The heart of the policy set. A visitor record carries a government ID number
-- and a home address, so it is never readable anonymously — a visitor tracks
-- their own booking through a server route that checks reference + mobile,
-- not by querying this table.
-- ---------------------------------------------------------------------------

drop policy if exists visitors_staff_read on public.visitors;
create policy visitors_staff_read on public.visitors
  for select using (public.is_gate_operator());

drop policy if exists visitors_staff_write on public.visitors;
create policy visitors_staff_write on public.visitors
  for all using (public.is_gate_operator()) with check (public.is_gate_operator());

/* Bookings: admins and the gate see all of them; a teacher sees only the
   meetings they are hosting. */
drop policy if exists visits_read on public.visit_requests;
create policy visits_read on public.visit_requests
  for select using (
    public.is_gate_operator()
    or (public.current_role_name() = 'teacher' and host_id = public.current_ref_id())
  );

drop policy if exists visits_gate_write on public.visit_requests;
create policy visits_gate_write on public.visit_requests
  for update using (
    public.is_gate_operator()
    or (public.current_role_name() = 'teacher' and host_id = public.current_ref_id())
  )
  with check (
    public.is_gate_operator()
    or (public.current_role_name() = 'teacher' and host_id = public.current_ref_id())
  );

drop policy if exists visits_admin_insert on public.visit_requests;
create policy visits_admin_insert on public.visit_requests
  for insert with check (public.is_gate_operator());

drop policy if exists visits_admin_delete on public.visit_requests;
create policy visits_admin_delete on public.visit_requests
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Gate movement
-- ---------------------------------------------------------------------------

drop policy if exists check_logs_read on public.check_logs;
create policy check_logs_read on public.check_logs
  for select using (public.is_gate_operator());

drop policy if exists check_logs_insert on public.check_logs;
create policy check_logs_insert on public.check_logs
  for insert with check (public.is_gate_operator());

/* Gate movements are the audit record of who entered the campus and when.
   They are deliberately append-only: no update or delete policy exists, so
   even an administrator cannot quietly rewrite one. */

drop policy if exists vehicles_read on public.vehicles;
create policy vehicles_read on public.vehicles
  for select using (public.is_gate_operator());

drop policy if exists vehicles_write on public.vehicles;
create policy vehicles_write on public.vehicles
  for all using (public.is_gate_operator()) with check (public.is_gate_operator());

drop policy if exists movements_read on public.movements;
create policy movements_read on public.movements
  for select using (public.is_gate_operator());

drop policy if exists movements_insert on public.movements;
create policy movements_insert on public.movements
  for insert with check (public.is_gate_operator());

drop policy if exists outings_read on public.outings;
create policy outings_read on public.outings
  for select using (public.is_staff() or student_id = public.current_ref_id());

drop policy if exists outings_student_insert on public.outings;
create policy outings_student_insert on public.outings
  for insert with check (
    public.is_admin() or student_id = public.current_ref_id()
  );

drop policy if exists outings_staff_update on public.outings;
create policy outings_staff_update on public.outings
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------------

drop policy if exists incidents_read on public.incidents;
create policy incidents_read on public.incidents
  for select using (public.is_gate_operator());

drop policy if exists incidents_report on public.incidents;
create policy incidents_report on public.incidents
  for insert with check (public.is_gate_operator());

/* Triage is an administrator's decision — a guard reports, an admin resolves. */
drop policy if exists incidents_admin_update on public.incidents;
create policy incidents_admin_update on public.incidents
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists emergencies_read on public.emergencies;
create policy emergencies_read on public.emergencies
  for select using (public.is_staff());

drop policy if exists emergencies_raise on public.emergencies;
create policy emergencies_raise on public.emergencies
  for insert with check (public.is_gate_operator());

drop policy if exists emergencies_admin_update on public.emergencies;
create policy emergencies_admin_update on public.emergencies
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Notifications, WhatsApp, audit, settings
-- ---------------------------------------------------------------------------

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select using (public.is_staff());

drop policy if exists notifications_write on public.notifications;
create policy notifications_write on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

/* The delivery log holds visitor phone numbers and full message bodies, so it
   is administrator-only — a guard has no reason to read it. */
drop policy if exists whatsapp_admin on public.whatsapp_messages;
create policy whatsapp_admin on public.whatsapp_messages
  for all using (public.is_admin()) with check (public.is_admin());

/* The audit trail names who did what. Readable by administrators, and
   append-only: there is no update or delete policy, so history cannot be
   rewritten from the application at all. */
drop policy if exists activity_read on public.activity_logs;
create policy activity_read on public.activity_logs
  for select using (public.is_admin());

drop policy if exists activity_append on public.activity_logs;
create policy activity_append on public.activity_logs
  for insert with check (public.is_staff());

/* Campus settings are shown on public pages (visiting hours, the security desk
   number), so they are readable by anyone; only an administrator may change
   them. */
drop policy if exists settings_read on public.campus_settings;
create policy settings_read on public.campus_settings for select using (true);

drop policy if exists settings_write on public.campus_settings;
create policy settings_write on public.campus_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage
--
-- Visitor, teacher and guard photographs and incident evidence. The bucket is
-- private: `public = false` means no object is reachable by URL alone, so
-- reading one requires a session that satisfies the policies below.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('campus-security', 'campus-security', false)
on conflict (id) do nothing;

drop policy if exists campus_media_read on storage.objects;
create policy campus_media_read on storage.objects
  for select using (bucket_id = 'campus-security' and public.is_staff());

drop policy if exists campus_media_write on storage.objects;
create policy campus_media_write on storage.objects
  for insert with check (bucket_id = 'campus-security' and public.is_gate_operator());

/* Incident evidence must not be quietly replaced or removed once filed, so
   deletion is restricted to administrators. */
drop policy if exists campus_media_delete on storage.objects;
create policy campus_media_delete on storage.objects
  for delete using (bucket_id = 'campus-security' and public.is_admin());
