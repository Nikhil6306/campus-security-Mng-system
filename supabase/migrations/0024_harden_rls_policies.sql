-- ---------------------------------------------------------------------------
-- 0024 — Harden Permissive RLS Policies (Remove `USING (true)` / `WITH CHECK (true)`)
--
-- Replaces overly permissive RLS policies introduced in migrations 0014, 0019,
-- and 0020 with role- and state-scoped restrictions.
-- ---------------------------------------------------------------------------

-- 1. Guard Duty & Shift Handover tables (0014): restrict SELECT to staff only
drop policy if exists staffing_read on public.gate_staffing_requirements;
create policy staffing_read on public.gate_staffing_requirements
  for select to authenticated using (public.is_staff());

drop policy if exists assignments_read on public.guard_shift_assignments;
create policy assignments_read on public.guard_shift_assignments
  for select to authenticated using (public.is_staff());

drop policy if exists sessions_read on public.guard_shift_sessions;
create policy sessions_read on public.guard_shift_sessions
  for select to authenticated using (public.is_staff());

drop policy if exists patrol_routes_read on public.patrol_routes;
create policy patrol_routes_read on public.patrol_routes
  for select to authenticated using (public.is_staff());

drop policy if exists patrol_checkpoints_read on public.patrol_checkpoints;
create policy patrol_checkpoints_read on public.patrol_checkpoints
  for select to authenticated using (public.is_staff());

drop policy if exists patrol_subs_read on public.patrol_submissions;
create policy patrol_subs_read on public.patrol_submissions
  for select to authenticated using (public.is_staff());

drop policy if exists handovers_read on public.shift_handovers;
create policy handovers_read on public.shift_handovers
  for select to authenticated using (public.is_staff());

drop policy if exists handover_items_read on public.shift_handover_items;
create policy handover_items_read on public.shift_handover_items
  for select to authenticated using (public.is_staff());

-- 2. Password Reset OTPs (0019): service_role bypasses RLS implicitly;
--    remove redundant USING (true) / WITH CHECK (true) and deny all anon/auth access.
drop policy if exists "Service role manages password reset otps" on public.password_reset_otps;
drop policy if exists "Public cannot read OTP records" on public.password_reset_otps;
create policy "Deny anon and authenticated access to password reset otps"
  on public.password_reset_otps
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- 3. Guard Registration Requests (0020): restrict public inserts to PENDING
--    unreviewed rows only (cannot self-approve via direct REST insert).
drop policy if exists "Anyone can insert a guard registration request" on public.guard_registration_requests;
create policy "Public can submit pending guard registration request"
  on public.guard_registration_requests
  for insert
  to anon, authenticated
  with check (
    status = 'PENDING'
    and reviewed_at is null
    and reviewed_by is null
  );
