-- 0007 introduced anonymous visitor writes, broad authenticated access to
-- visitor records, and anonymous writes to a private photo bucket. The active
-- Next.js application does not write to Supabase; its validated server routes
-- remain the intended boundary if a later migration is approved.
--
-- Keep this as a forward-only migration so databases that already applied
-- 0007 receive the same restrictions as fresh installations.

drop policy if exists "Allow public visitor registration" on public.visitors;
drop policy if exists "Allow public visit request creation" on public.visit_requests;
drop policy if exists "Allow staff manage visitors" on public.visitors;
drop policy if exists "Allow staff manage visit requests" on public.visit_requests;

insert into storage.buckets (id, name, public)
values ('visitor-photos', 'visitor-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Allow visitor photos upload" on storage.objects;
drop policy if exists "Allow staff read visitor photos" on storage.objects;
drop policy if exists visitor_photos_staff_read on storage.objects;

create policy visitor_photos_staff_read on storage.objects
  for select using (
    bucket_id = 'visitor-photos'
    and public.is_staff()
  );

-- No anonymous/authenticated insert, update, or delete policy is granted for
-- this bucket. A future server upload path must authorize the actor and
-- validate the file before using a server-only service-role credential.
