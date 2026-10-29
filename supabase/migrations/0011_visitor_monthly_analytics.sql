-- ---------------------------------------------------------------------------
-- 0011 — Monthly Visitor Analytics & Public Aggregation Views
--
-- Provides privacy-safe aggregated monthly visitor statistics for:
--   1. Admin Panel Monthly Visitor Analytics Dashboard
--   2. Public Website Monthly Campus Visitor Statistics
--
-- Security rules:
--   * Only aggregated counts and timestamps are returned.
--   * Zero personal identifiable information (PII) is exposed.
--   * Row Level Security (RLS) on underlying visitor tables remains strictly enforced.
--   * SECURITY DEFINER functions with pinned search_path allow public aggregation
--     without granting select rights to raw visitor records.
-- ---------------------------------------------------------------------------

-- 1. Aggregated public view for monthly visitor statistics
create or replace view public.public_monthly_visitor_stats as
select
  extract(year from coalesce(vr.check_in_at at time zone 'Asia/Kolkata', vr.visit_date::timestamp))::int as year,
  extract(month from coalesce(vr.check_in_at at time zone 'Asia/Kolkata', vr.visit_date::timestamp))::int as month,
  to_char(coalesce(vr.check_in_at at time zone 'Asia/Kolkata', vr.visit_date::timestamp), 'FMMonth') as month_name,
  to_char(coalesce(vr.check_in_at at time zone 'Asia/Kolkata', vr.visit_date::timestamp), 'Mon') as month_short,
  count(*)::bigint as visit_count,
  coalesce(sum(vr.number_of_visitors), count(*))::bigint as visitor_count
from public.visit_requests vr
where (
  vr.status in ('Checked In', 'Meeting In Progress', 'Checked Out')
  or (vr.check_in_at is not null and vr.status not in ('Rejected', 'Cancelled', 'No Show', 'Expired'))
)
group by 1, 2, 3, 4
order by year desc, month asc;

-- Grant read permission to public view
grant select on public.public_monthly_visitor_stats to anon, authenticated, service_role;

-- 2. Function to retrieve monthly statistics for a given year or all years
create or replace function public.get_monthly_visitor_stats(target_year int default null)
returns table (
  year int,
  month int,
  month_name text,
  month_short text,
  visit_count bigint,
  visitor_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    extract(year from coalesce(vr.check_in_at at time zone 'Asia/Kolkata', vr.visit_date::timestamp))::int as year,
    extract(month from coalesce(vr.check_in_at at time zone 'Asia/Kolkata', vr.visit_date::timestamp))::int as month,
    to_char(coalesce(vr.check_in_at at time zone 'Asia/Kolkata', vr.visit_date::timestamp), 'FMMonth') as month_name,
    to_char(coalesce(vr.check_in_at at time zone 'Asia/Kolkata', vr.visit_date::timestamp), 'Mon') as month_short,
    count(*)::bigint as visit_count,
    coalesce(sum(vr.number_of_visitors), count(*))::bigint as visitor_count
  from public.visit_requests vr
  where (
    vr.status in ('Checked In', 'Meeting In Progress', 'Checked Out')
    or (vr.check_in_at is not null and vr.status not in ('Rejected', 'Cancelled', 'No Show', 'Expired'))
  )
  and (target_year is null or extract(year from coalesce(vr.check_in_at at time zone 'Asia/Kolkata', vr.visit_date::timestamp))::int = target_year)
  group by 1, 2, 3, 4
  order by year desc, month asc;
$$;

grant execute on function public.get_monthly_visitor_stats(int) to anon, authenticated, service_role;

-- 3. Function for aggregate visitor categories (admin analytics)
create or replace function public.get_visitor_category_stats(target_year int default null)
returns table (
  category text,
  count bigint,
  headcount bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(vr.visitor_type, 'Guest') as category,
    count(*)::bigint as count,
    coalesce(sum(vr.number_of_visitors), count(*))::bigint as headcount
  from public.visit_requests vr
  where (target_year is null or extract(year from coalesce(vr.check_in_at at time zone 'Asia/Kolkata', vr.visit_date::timestamp))::int = target_year)
  group by 1
  order by headcount desc;
$$;

grant execute on function public.get_visitor_category_stats(int) to anon, authenticated, service_role;
