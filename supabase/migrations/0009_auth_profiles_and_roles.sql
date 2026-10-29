-- ---------------------------------------------------------------------------
-- 0009 — Auth, Profiles, and Role-Based Access Control
--
-- Adds 'visitor' role, configures auth.users -> public.profiles synchronization,
-- and enforces role security and profile protection.
-- ---------------------------------------------------------------------------

-- 1. Ensure 'visitor' exists in app_role enum
do $$
begin
  alter type public.app_role add value if not exists 'visitor';
exception when duplicate_object then null;
end $$;

-- 2. Update is_admin() helper with SECURITY DEFINER
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and p.active
       and p.role in ('admin', 'super_admin')
  );
$$;

-- 3. Update is_gate_operator() helper
create or replace function public.is_gate_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and p.active
       and p.role in ('admin', 'super_admin', 'security')
  );
$$;

-- 4. Update is_staff() helper
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and p.active
       and p.role in ('admin', 'super_admin', 'security', 'teacher')
  );
$$;

-- 5. Trigger function to synchronize auth.users -> public.profiles on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assigned_role public.app_role := 'visitor';
  requested_role text;
  user_email text;
begin
  user_email := lower(trim(new.email));
  requested_role := lower(trim(coalesce(new.raw_user_meta_data->>'role', '')));

  -- Designated initial administrators
  if user_email in ('nikhilshukla1200@gmail.com', 'superadmin@dsvv.edu.in') then
    assigned_role := 'super_admin';
  elsif user_email = 'admin@dsvv.edu.in' then
    assigned_role := 'admin';
  elsif user_email = 'security@dsvv.edu.in' then
    assigned_role := 'security';
  elsif requested_role in ('security', 'teacher', 'admin', 'super_admin') then
    -- Elevated roles can only be set via explicit admin provisioning or invited metadata
    -- If created by an existing admin session, allow requested role; otherwise downgrade to visitor
    if public.is_admin() then
      assigned_role := requested_role::public.app_role;
    else
      assigned_role := 'visitor';
    end if;
  elsif requested_role = 'student' then
    assigned_role := 'student';
  else
    assigned_role := 'visitor';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    ref_id,
    gate,
    active,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    assigned_role,
    new.raw_user_meta_data->>'ref_id',
    new.raw_user_meta_data->>'gate',
    true,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 6. Trigger to update last_login_at on auth signin
create or replace function public.handle_user_login()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles
       set last_login_at = new.last_sign_in_at,
           updated_at = now()
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_login on auth.users;
create trigger on_auth_user_login
  after update on auth.users
  for each row
  execute function public.handle_user_login();

-- 7. Ensure RLS policies on public.profiles protect role and identity
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin() or public.is_staff());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and ref_id is not distinct from (select ref_id from public.profiles where id = auth.uid())
    and active = (select active from public.profiles where id = auth.uid())
  );

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());
