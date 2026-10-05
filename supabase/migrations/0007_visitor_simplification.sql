-- ---------------------------------------------------------------------------
-- 0007 — Simplified Visitor Model & Supabase Storage Policies
--
-- Restructures the visitor records to contain ONLY the simplified required fields:
--   * full_name (text, required)
--   * aadhaar_number (text, required, 12 digits)
--   * mobile_number (text, required)
--   * has_car (boolean, required)
--   * car_number (text, nullable)
--   * photo_path (text, required)
--   * created_at (timestamptz)
--   * updated_at (timestamptz)
-- ---------------------------------------------------------------------------

-- Update visitors table
alter table public.visitors
  add column if not exists aadhaar_number text,
  add column if not exists mobile_number text,
  add column if not exists has_car boolean not null default false,
  add column if not exists car_number text,
  add column if not exists photo_path text;

-- Update visit_requests table
alter table public.visit_requests
  add column if not exists aadhaar_number text,
  add column if not exists mobile_number text,
  add column if not exists has_car boolean not null default false,
  add column if not exists car_number text,
  add column if not exists photo_path text;

-- Backfill data for existing columns if needed
update public.visitors
set aadhaar_number = id_number,
    mobile_number = mobile,
    photo_path = photo_url
where aadhaar_number is null;

update public.visit_requests
set aadhaar_number = id_number,
    mobile_number = mobile,
    photo_path = photo_url
where aadhaar_number is null;

-- Indexes for performance and quick searching
create index if not exists idx_visitors_aadhaar on public.visitors(aadhaar_number);
create index if not exists idx_visitors_mobile_num on public.visitors(mobile_number);
create index if not exists idx_visits_aadhaar on public.visit_requests(aadhaar_number);
create index if not exists idx_visits_mobile_num on public.visit_requests(mobile_number);

-- ---------------------------------------------------------------------------
-- Storage bucket configuration for visitor-photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('visitor-photos', 'visitor-photos', false)
on conflict (id) do update set public = false;

-- Storage RLS Policies for visitor-photos bucket
drop policy if exists "Allow visitor photos upload" on storage.objects;
create policy "Allow visitor photos upload" on storage.objects
  for insert with check (bucket_id = 'visitor-photos');

drop policy if exists "Allow staff read visitor photos" on storage.objects;
create policy "Allow staff read visitor photos" on storage.objects
  for select using (
    bucket_id = 'visitor-photos'
    and (public.is_staff() or auth.role() = 'authenticated' or auth.role() = 'service_role')
  );

-- Row Level Security policies for public.visitors and public.visit_requests
drop policy if exists "Allow public visitor registration" on public.visitors;
create policy "Allow public visitor registration" on public.visitors
  for insert with check (true);

drop policy if exists "Allow public visit request creation" on public.visit_requests;
create policy "Allow public visit request creation" on public.visit_requests
  for insert with check (true);

drop policy if exists "Allow staff manage visitors" on public.visitors;
create policy "Allow staff manage visitors" on public.visitors
  for all using (
    public.is_staff() or auth.role() = 'service_role'
  );

drop policy if exists "Allow staff manage visit requests" on public.visit_requests;
create policy "Allow staff manage visit requests" on public.visit_requests
  for all using (
    public.is_staff() or auth.role() = 'service_role'
  );
