-- ---------------------------------------------------------------------------
-- 0003 — accompanying visitors, and the booking replay guard
--
-- PostgreSQL / Supabase parity for the SQLite schema in `lib/server/schema.ts`.
-- Apply after 0001_schema.sql and 0002_rls.sql.
--
-- AADHAAR HANDLING
-- ----------------
-- `aadhaar_ciphertext` holds an AES-256-GCM envelope produced by the
-- application (`lib/server/aadhaar.ts`) under AADHAAR_ENCRYPTION_KEY. The
-- database never sees a plaintext Aadhaar number, so a database compromise
-- alone does not disclose one. Where the deployment sets no key, the column is
-- NULL and only `aadhaar_last4` is retained — the data-minimised default.
--
-- `aadhaar_last4` is the only fragment any interface renders, always as
-- XXXXXXXX1234.
-- ---------------------------------------------------------------------------

create table if not exists public.visit_guests (
  id                 text primary key,
  booking_id         text not null references public.visit_requests(id) on delete cascade,
  position           integer not null check (position >= 2),
  full_name          text not null,
  mobile             text not null,
  aadhaar_ciphertext text,
  aadhaar_hash       text,
  aadhaar_last4      text not null check (aadhaar_last4 ~ '^[0-9]{4}$'),
  relation           text not null,
  address            text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_guests_booking on public.visit_guests(booking_id);
create unique index if not exists uniq_guest_position
  on public.visit_guests(booking_id, position);

-- Duplicate detection without ever comparing plaintext.
create index if not exists idx_guests_aadhaar_hash on public.visit_guests(aadhaar_hash);

-- ---------------------------------------------------------------------------
-- Booking replay guard and lookup indexes
-- ---------------------------------------------------------------------------

alter table public.visit_requests
  add column if not exists idempotency_key text;

create unique index if not exists uniq_visits_idempotency
  on public.visit_requests(idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_visits_whatsapp on public.visit_requests(whatsapp_number);
create index if not exists idx_visits_pass_token on public.visit_requests(pass_token);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Guests inherit the visibility of the booking they belong to: gate operators
-- and administrators see them, and a host sees only the parties attending
-- their own meetings. There is no anonymous read policy — the public booking
-- form writes through the server, never directly from the browser.
-- ---------------------------------------------------------------------------

alter table public.visit_guests enable row level security;

drop policy if exists guests_read on public.visit_guests;
create policy guests_read on public.visit_guests
  for select using (
    public.is_gate_operator()
    or exists (
      select 1
      from public.visit_requests v
      where v.id = visit_guests.booking_id
        and public.current_role_name() = 'teacher'
        and v.host_id = public.current_ref_id()
    )
  );

/* Written by the server on behalf of a visitor who has no session, and
   corrected only by an administrator. */
drop policy if exists guests_admin_write on public.visit_guests;
create policy guests_admin_write on public.visit_guests
  for all using (public.is_admin()) with check (public.is_admin());
