-- ---------------------------------------------------------------------------
-- 0022 — Fix Admin Email Trigger Blocking SuperAdmin/Admin Sign-In
--
-- Fixes "Database error granting user" during signInWithPassword for
-- superadmin@dsvv.edu.in / admin@dsvv.edu.in caused by trg_check_admin_role_email
-- firing when on_auth_user_login updates public.profiles.last_login_at.
-- ---------------------------------------------------------------------------

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

create or replace function public.check_admin_role_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role in ('admin', 'super_admin')
     and lower(trim(new.email)) not in (
       'nikhilshukla1200@gmail.com',
       'superadmin@dsvv.edu.in',
       'admin@dsvv.edu.in'
     ) then
    raise exception 'Access denied. This email is not authorized to receive administrator privileges.';
  end if;
  return new;
end;
$$;
