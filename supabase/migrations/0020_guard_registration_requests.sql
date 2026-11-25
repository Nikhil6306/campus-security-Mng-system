-- ---------------------------------------------------------------------------
-- 0020 — Guard Registration Requests and Approvals
--
-- Enables guard self-registration with admin approval workflow.
-- Status transitions: PENDING -> APPROVED | REJECTED | SUSPENDED
-- ---------------------------------------------------------------------------

create table if not exists public.guard_registration_requests (
  id               text primary key,
  full_name        text not null,
  email            text not null unique,
  phone            text not null,
  guard_id         text not null,
  designation      text not null default 'Security Guard',
  assigned_gate    text not null default 'Main Gate',
  password_hash    text not null default '',
  password_salt    text not null default '',
  status           text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  rejection_reason text,
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      text
);

create index if not exists idx_guard_req_status on public.guard_registration_requests(status);
create index if not exists idx_guard_req_email on public.guard_registration_requests(email);

-- Enable Row Level Security
alter table public.guard_registration_requests enable row level security;

-- Policies
create policy "Admins have full access to guard registration requests"
  on public.guard_registration_requests
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
    )
  );

create policy "Guards can read their own registration request"
  on public.guard_registration_requests
  for select
  to authenticated
  using (
    email = auth.jwt() ->> 'email'
  );

create policy "Anyone can insert a guard registration request"
  on public.guard_registration_requests
  for insert
  to anon, authenticated
  with check (true);
