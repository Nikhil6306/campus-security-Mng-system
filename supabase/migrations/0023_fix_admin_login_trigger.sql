-- ---------------------------------------------------------------------------
-- 0023 – Definitive Fix for "Database error granting user" on Admin Login
--
-- ROOT CAUSE:
--   trg_check_admin_role_email fires BEFORE INSERT OR UPDATE on public.profiles.
--   During signInWithPassword, on_auth_user_login -> handle_user_login()
--   updates public.profiles.last_login_at. Under 0009, superadmin@dsvv.edu.in
--   and admin@dsvv.edu.in were rejected by check_admin_role_email(), causing
--   Supabase Auth to fail with "Database error granting user".
--   Migration 0022 expanded the email allowlist, but still ran the check on
--   every UPDATE regardless of whether role or email changed, and did not
--   recreate the trigger.
--
-- FIX:
--   1. Enforce admin email authorization on INSERT, or on UPDATE when `role`
--      or `email` changes.
--   2. Allow normal profile updates (last_login_at, updated_at, full_name,
--      etc.) without unnecessary trigger rejection.
--   3. Drop and recreate trg_check_admin_role_email cleanly.
--   4. Keep is_admin() SECURITY DEFINER with safe search_path.
-- ---------------------------------------------------------------------------

-- 1. Replace check_admin_role_email to check on INSERT, role change, or email change
create or replace function public.check_admin_role_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if TG_OP = 'INSERT'
     or (TG_OP = 'UPDATE' and (
       new.role is distinct from old.role
       or lower(trim(new.email)) is distinct from lower(trim(old.email))
     )) then
    if new.role in ('admin', 'super_admin')
       and lower(trim(new.email)) not in (
         'nikhilshukla1200@gmail.com',
         'superadmin@dsvv.edu.in',
         'admin@dsvv.edu.in'
       ) then
      raise exception 'Access denied. This email is not authorized to receive administrator privileges.';
    end if;
  end if;
  return new;
end;
$$;

-- 2. Drop and recreate the trigger to pick up the updated function
drop trigger if exists trg_check_admin_role_email on public.profiles;
create trigger trg_check_admin_role_email
  before insert or update on public.profiles
  for each row
  execute function public.check_admin_role_email();

-- 3. Update is_admin() to allow all legitimate admin emails (remove single-email restriction)
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

-- 4. Ensure superadmin@dsvv.edu.in and admin@dsvv.edu.in profiles have correct roles
-- (This is a no-op if the data is already correct; safe to run repeatedly)
update public.profiles
  set role = 'super_admin',
      active = true,
      updated_at = now()
where lower(trim(email)) = 'superadmin@dsvv.edu.in'
  and role <> 'super_admin';

update public.profiles
  set role = 'admin',
      active = true,
      updated_at = now()
where lower(trim(email)) = 'admin@dsvv.edu.in'
  and role <> 'admin';
