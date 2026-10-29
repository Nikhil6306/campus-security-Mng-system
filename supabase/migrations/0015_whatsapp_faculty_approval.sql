-- ---------------------------------------------------------------------------
-- 0015 — WhatsApp-based Faculty Approval, Approval Tokens & Pass Issuance
--
-- Adds approval token records for signed one-time action links, faculty user_id
-- linkage, and RLS policies for faculty decision workflows.
-- ---------------------------------------------------------------------------

-- 1. Ensure teachers table has official WhatsApp number & optional authenticated user linkage
alter table public.teachers
  add column if not exists whatsapp_number text not null default '',
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_teachers_user on public.teachers(user_id);
create index if not exists idx_teachers_whatsapp on public.teachers(whatsapp_number);

-- 2. Create approval_tokens table for signed, single-use, short-lived WhatsApp action links
create table if not exists public.approval_tokens (
  id          text primary key,
  token_hash  text not null unique,
  booking_id  text not null references public.visit_requests(id) on delete cascade,
  faculty_id  text not null references public.teachers(id) on delete cascade,
  action      text not null check (action in ('accept', 'reject', 'decide')),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_approval_tokens_booking on public.approval_tokens(booking_id);
create index if not exists idx_approval_tokens_faculty on public.approval_tokens(faculty_id);
create index if not exists idx_approval_tokens_hash on public.approval_tokens(token_hash);

comment on table public.approval_tokens is
  'Single-use, cryptographically hashed tokens for signed WhatsApp faculty decision links.';

-- 3. Row Level Security for approval_tokens
alter table public.approval_tokens enable row level security;

-- Admin and Security roles full access
drop policy if exists approval_tokens_admin on public.approval_tokens;
create policy approval_tokens_admin on public.approval_tokens
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'admin')
        and p.active
    )
  );

-- Faculty can view approval tokens assigned to their faculty profile (for verification)
drop policy if exists approval_tokens_faculty on public.approval_tokens;
create policy approval_tokens_faculty on public.approval_tokens
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'teacher'
        and p.ref_id = faculty_id
        and p.active
    )
  );

-- 4. Allow faculty members to update visit_requests assigned to them (accept/reject)
drop policy if exists visits_faculty_decision on public.visit_requests;
create policy visits_faculty_decision on public.visit_requests
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role in ('super_admin', 'admin') or
          (p.role = 'teacher' and p.ref_id = host_id)
        )
        and p.active
    )
  );
