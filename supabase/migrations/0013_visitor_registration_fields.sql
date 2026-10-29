-- ---------------------------------------------------------------------------
-- 0013 — Visitor Registration Fields & Departures
--
-- Adds expected_departure_time and vehicle_type to public.visit_requests
-- to match the visitor registration workflow and support vehicle tracking.
-- ---------------------------------------------------------------------------

alter table public.visit_requests
  add column if not exists expected_departure_time text,
  add column if not exists vehicle_type text;

create index if not exists idx_visits_expected_departure
  on public.visit_requests(expected_departure_time);
