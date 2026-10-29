-- ---------------------------------------------------------------------------
-- 0009 — Admin Email Restriction
--
-- Enforces that ONLY 'nikhilshukla1200@gmail.com' can hold 'admin' or 'super_admin'
-- roles in public.profiles, and updates public.is_admin() to verify this email.
-- ---------------------------------------------------------------------------

-- Update is_admin() function to strictly require nikhilshukla1200@gmail.com
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
       and lower(trim(p.email)) = 'nikhilshukla1200@gmail.com'
  );
$$;

-- Trigger to prevent any other email from receiving admin or super_admin roles
create or replace function public.check_admin_role_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role in ('admin', 'super_admin') and lower(trim(new.email)) <> 'nikhilshukla1200@gmail.com' then
    raise exception 'Access denied. This email is not authorized to receive administrator privileges.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_admin_role_email on public.profiles;
create trigger trg_check_admin_role_email
  before insert or update on public.profiles
  for each row
  execute function public.check_admin_role_email();
