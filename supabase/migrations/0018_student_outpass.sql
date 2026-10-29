-- ---------------------------------------------------------------------------
-- 0018 — Student Hostels, Outpass Requests & Digital QR Passes
--
-- Adds:
--   hostels              — Hostel/block configuration
--   hostel_memberships   — Student-to-hostel assignment (admin-managed)
--   outpass_requests     — Student outpass with approval workflow
--   student_passes       — Secure QR pass linked to approved outpass
--   student_gate_events  — Gate entry/exit events for student passes
-- ---------------------------------------------------------------------------

-- 1. Hostel configuration
create table if not exists public.hostels (
  id          text primary key,
  name        text not null unique,
  kind        text not null default 'Hostel'
              check (kind in ('Hostel','Block','Wing')),
  gender      text not null default 'Mixed'
              check (gender in ('Male','Female','Mixed')),
  capacity    integer,
  warden_id   text references public.teachers(id) on delete set null,
  warden_name text not null default '',
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Student-hostel assignment (admin controls, student cannot self-assign)
create table if not exists public.hostel_memberships (
  id          text primary key,
  student_id  text not null references public.students(id) on delete cascade,
  hostel_id   text not null references public.hostels(id) on delete cascade,
  room_number text not null default '',
  -- Approval chain: which teacher/warden approves this student's outpasses
  approver_id   text references public.teachers(id) on delete set null,
  approver_name text not null default '',
  active      boolean not null default true,
  assigned_at timestamptz not null default now(),
  assigned_by text not null,
  notes       text
);

create unique index if not exists uniq_hostel_student_active
  on public.hostel_memberships(student_id)
  where active = true;

create index if not exists idx_hm_hostel on public.hostel_memberships(hostel_id);

-- 3. Outpass requests (extends the concept of outings with richer workflow)
create table if not exists public.outpass_requests (
  id          text primary key,

  -- Student (from authenticated session — never client-supplied)
  student_id    text not null references public.students(id) on delete cascade,
  student_name  text not null,
  student_roll  text not null,
  hostel_id     text references public.hostels(id) on delete set null,
  hostel_name   text not null default '',

  -- Request details
  purpose       text not null,
  destination   text not null default '',
  emergency_contact text not null default '',
  departure_at  timestamptz not null,
  expected_return_at timestamptz,
  notes         text,

  -- Approval
  approver_id   text references public.teachers(id) on delete set null,
  approver_name text not null default '',
  status        text not null default 'PENDING'
                check (status in (
                  'PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED')),
  decided_at    timestamptz,
  decided_by    text,
  rejection_reason text,

  -- Extension (approved by warden)
  extended_return_at timestamptz,
  extension_note     text,

  -- Timestamps (server-side)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_opr_student on public.outpass_requests(student_id);
create index if not exists idx_opr_status  on public.outpass_requests(status);
create index if not exists idx_opr_approver on public.outpass_requests(approver_id);

-- 4. Digital QR passes (one per approved outpass, never for pending/rejected)
create table if not exists public.student_passes (
  id           text primary key,
  outpass_id   text not null unique references public.outpass_requests(id) on delete cascade,
  student_id   text not null references public.students(id) on delete cascade,
  student_name text not null,
  -- Opaque, unpredictable token; only SHA-256 hash stored
  pass_token_hash text not null unique,
  -- Validity window
  valid_from   timestamptz not null,
  valid_until  timestamptz not null,
  -- State machine: ACTIVE → EXITED → RETURNED | EXPIRED | CANCELLED
  state        text not null default 'ACTIVE'
               check (state in ('ACTIVE','EXITED','RETURNED','EXPIRED','CANCELLED')),
  -- Issued by (system on approval)
  issued_by    text not null default 'system',
  issued_at    timestamptz not null default now(),
  -- Cancellation
  cancelled_by  text,
  cancelled_at  timestamptz,
  cancellation_note text,
  -- Late return flag (set by server-side check)
  late_return   boolean not null default false,
  late_alert_sent boolean not null default false
);

create index if not exists idx_sp_student on public.student_passes(student_id);
create index if not exists idx_sp_state   on public.student_passes(state);
create index if not exists idx_sp_valid   on public.student_passes(valid_until);

-- 5. Student gate events (entry/exit log per pass scan)
create table if not exists public.student_gate_events (
  id          text primary key,
  pass_id     text not null references public.student_passes(id) on delete cascade,
  outpass_id  text not null references public.outpass_requests(id) on delete cascade,
  student_id  text not null references public.students(id) on delete cascade,
  student_name text not null,
  direction   text not null check (direction in ('EXIT','ENTRY')),
  gate        text not null,
  scanned_by  text,              -- guard id
  scanned_by_name text not null default '',
  note        text,
  -- Override: emergency exception by authorized role
  is_override    boolean not null default false,
  override_by    text,
  override_note  text,
  at          timestamptz not null default now()
);

-- Each pass can only have one EXIT and one ENTRY event (prevent duplicates)
create unique index if not exists uniq_sge_direction
  on public.student_gate_events(pass_id, direction)
  where is_override = false;

create index if not exists idx_sge_student on public.student_gate_events(student_id);
create index if not exists idx_sge_at      on public.student_gate_events(at);

-- 6. RLS
alter table public.hostels              enable row level security;
alter table public.hostel_memberships   enable row level security;
alter table public.outpass_requests     enable row level security;
alter table public.student_passes       enable row level security;
alter table public.student_gate_events  enable row level security;

-- Admin: full access to everything
create policy hostels_admin on public.hostels for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active));

create policy hm_admin on public.hostel_memberships for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active));

create policy opr_admin on public.outpass_requests for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active));

create policy sp_admin on public.student_passes for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active));

create policy sge_admin on public.student_gate_events for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','admin') and p.active));

-- Students: read/create own outpass requests; read own pass
create policy opr_student_insert on public.outpass_requests for insert
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student' and p.active
    -- student can only submit for themselves
    and p.ref_id = student_id
  ));

create policy opr_student_read on public.outpass_requests for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student' and p.active and p.ref_id = student_id
  ));

create policy opr_student_cancel on public.outpass_requests for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student' and p.active
    and p.ref_id = student_id
    -- students can only cancel their own PENDING requests
    and status = 'PENDING'
  ));

create policy sp_student_read on public.student_passes for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student' and p.active and p.ref_id = student_id
  ));

create policy sge_student_read on public.student_gate_events for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student' and p.active and p.ref_id = student_id
  ));

-- Wardens/Teachers: approve/reject outpass requests for their students
create policy opr_teacher_read on public.outpass_requests for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher' and p.active and p.ref_id = approver_id
  ));

create policy opr_teacher_decide on public.outpass_requests for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher' and p.active and p.ref_id = approver_id
    -- warden can only approve/reject PENDING requests
    and status = 'PENDING'
  ));

-- Guards: read passes and insert gate events
create policy sp_guard_read on public.student_passes for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('security','admin','super_admin') and p.active
  ));

create policy sge_guard_insert on public.student_gate_events for insert
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('security','admin','super_admin') and p.active
  ));

create policy sge_guard_read on public.student_gate_events for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('security','admin','super_admin') and p.active
  ));

-- Hostels: readable by all authenticated users (public configuration)
create policy hostels_read on public.hostels for select
  using (auth.uid() is not null);

-- 7. Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.outpass_requests;
    alter publication supabase_realtime add table public.student_passes;
    alter publication supabase_realtime add table public.student_gate_events;
  end if;
exception when duplicate_object then null;
end $$;
