-- ---------------------------------------------------------------------------
-- 0005 — mandatory visitor photographs
--
-- PostgreSQL / Supabase parity for `lib/server/schema.ts` and
-- `lib/server/photo-store.ts`. Apply after 0004.
--
-- A photograph is now required to create a booking. What that means here:
--
--   * `photo_url` names an object in the private `campus-security` bucket,
--     e.g. `visitor-photos/<id>.jpg`. The image itself is never stored in a
--     column, and never as base64.
--   * The column stays nullable. Bookings taken before this release have no
--     photograph, and must keep working — the requirement is enforced on
--     creation, in `bookingSchema`, not by a constraint that would invalidate
--     history.
--   * Object names are built from a server-generated 24-byte id. Nothing a
--     visitor typed reaches a storage path.
-- ---------------------------------------------------------------------------

alter table public.visitors
  add column if not exists photo_url text;

alter table public.visit_requests
  add column if not exists photo_url text;

comment on column public.visitors.photo_url is
  'Object name of the visitor''s current photograph in the private campus-security bucket (visitor-photos/<id>.<ext>). NULL only for visitors created before photographs were required.';
comment on column public.visit_requests.photo_url is
  'Object name of the photograph captured for this visit. NULL only for bookings created before photographs were required.';

-- Lets the gate find bookings that still lack a photograph, which is the only
-- query this column is filtered on.
create index if not exists idx_visits_missing_photo
  on public.visit_requests(visit_date)
  where photo_url is null;

-- ---------------------------------------------------------------------------
-- Storage
--
-- The `campus-security` bucket is created private in 0002. This tightens the
-- rules for the `visitor-photos/` prefix specifically, because a visitor's face
-- is identity data and the general media policies are broader than it needs.
--
-- Reading stays staff-only, matching `/api/visitor-photo/[id]`. Writing is
-- deliberately NOT granted to `anon`: the public upload endpoint runs on the
-- server under the service role, which lets the server sniff the bytes and cap
-- the size before anything is stored. An anonymous client that could write
-- straight to the bucket would bypass both checks.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('campus-security', 'campus-security', false)
on conflict (id) do update set public = false;

/* Ordinary media (teacher and guard photographs, incident evidence) keeps the
   0002 policies. Visitor photographs are carved out of them so the prefix can
   be reasoned about on its own. */
drop policy if exists campus_media_read on storage.objects;
create policy campus_media_read on storage.objects
  for select using (
    bucket_id = 'campus-security'
    and public.is_staff()
    and (storage.foldername(name))[1] <> 'visitor-photos'
  );

drop policy if exists visitor_photos_read on storage.objects;
create policy visitor_photos_read on storage.objects
  for select using (
    bucket_id = 'campus-security'
    and (storage.foldername(name))[1] = 'visitor-photos'
    and public.is_staff()
  );

/* No insert, update or delete policy exists for `visitor-photos/`. With RLS on
   and no permissive policy, every writer is refused except the service role,
   which bypasses policies — and the service role key is server-side only. That
   is the intent: photographs are written by the validated upload path or not
   at all. */
drop policy if exists campus_media_write on storage.objects;
create policy campus_media_write on storage.objects
  for insert with check (
    bucket_id = 'campus-security'
    and public.is_gate_operator()
    and (storage.foldername(name))[1] <> 'visitor-photos'
  );

drop policy if exists campus_media_delete on storage.objects;
create policy campus_media_delete on storage.objects
  for delete using (
    bucket_id = 'campus-security'
    and public.is_admin()
    and (storage.foldername(name))[1] <> 'visitor-photos'
  );
