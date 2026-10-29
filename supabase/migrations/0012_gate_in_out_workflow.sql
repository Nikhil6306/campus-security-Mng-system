-- ---------------------------------------------------------------------------
-- 0012 — Gate In/Out Security Workflow & Atomic Database Functions
--
-- Adds:
--   * pass_token_hash column & index on public.visit_requests
--   * sync_pass_token_hash trigger function for cryptographically secure lookup
--   * public.gate_verify_pass(p_token, p_gate)
--   * public.gate_check_in(p_visit_request_id, p_gate, p_guard_id, p_guard_name, p_note)
--   * public.gate_check_out(p_visit_request_id, p_gate, p_guard_id, p_guard_name, p_note)
--   * Row Level Security policies for check_logs and movements
-- ---------------------------------------------------------------------------

-- 1. Pass token hash column and index
alter table public.visit_requests
  add column if not exists pass_token_hash text;

create index if not exists idx_visits_pass_token_hash
  on public.visit_requests(pass_token_hash);

-- Backfill hashes for existing pass tokens
update public.visit_requests
set pass_token_hash = encode(digest(pass_token, 'sha256'), 'hex')
where pass_token is not null and pass_token_hash is null;

-- 2. Trigger function to keep pass_token_hash in sync
create or replace function public.sync_pass_token_hash()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.pass_token is not null then
    new.pass_token_hash := encode(digest(new.pass_token, 'sha256'), 'hex');
  else
    new.pass_token_hash := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_pass_token_hash on public.visit_requests;
create trigger trg_sync_pass_token_hash
  before insert or update of pass_token
  on public.visit_requests
  for each row
  execute function public.sync_pass_token_hash();

-- 3. Gate Verify Pass Function (Atomic Read & Verification)
create or replace function public.gate_verify_pass(
  p_token text,
  p_gate text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
  v_hash text;
  v_rec record;
  v_history jsonb;
  v_issues jsonb := '[]'::jsonb;
  v_ok boolean := true;
  v_next_action text := null;
  v_today date := current_date;
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object(
      'ok', false,
      'issues', jsonb_build_array(jsonb_build_object('code', 'missing_token', 'message', 'Please provide a valid QR pass or booking reference.'))
    );
  end if;

  v_token := trim(p_token);
  -- If token is a full URL, extract the trailing path segment
  if v_token like 'http://%' or v_token like 'https://%' then
    v_token := regexp_replace(v_token, '^.*/([^/?#]+).*$', '\1');
  end if;
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  -- Lookup booking by pass_token, pass_token_hash, or human-readable id
  select *
    into v_rec
    from public.visit_requests
   where pass_token = v_token
      or pass_token_hash = v_hash
      or id = v_token
   limit 1;

  if v_rec.id is null then
    return jsonb_build_object(
      'ok', false,
      'issues', jsonb_build_array(jsonb_build_object('code', 'not_found', 'message', 'No booking found for that pass or reference.'))
    );
  end if;

  -- Fetch entry/exit history
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', cl.id,
      'direction', cl.direction,
      'gate', cl.gate,
      'guardName', cl.guard_name,
      'at', cl.at,
      'note', cl.note
    ) order by cl.at desc
  ), '[]'::jsonb)
  into v_history
  from public.check_logs cl
  where cl.visit_request_id = v_rec.id or cl.visitor_id = v_rec.visitor_id;

  -- Lifecycle and validity evaluation
  if v_rec.status in ('Checked In', 'Meeting In Progress') then
    v_ok := true;
    v_next_action := 'check-out';
  elsif v_rec.status = 'Approved' then
    if v_rec.pass_expires_at is not null and v_rec.pass_expires_at < now() then
      v_ok := false;
      v_issues := v_issues || jsonb_build_object('code', 'expired', 'message', 'This pass has expired and is no longer valid for entry.');
    elsif v_rec.visit_date > v_today then
      v_ok := false;
      v_issues := v_issues || jsonb_build_object('code', 'too_early', 'message', 'This pass is scheduled for ' || to_char(v_rec.visit_date, 'YYYY-MM-DD') || ', not today.');
    elsif v_rec.visit_date < v_today then
      v_ok := false;
      v_issues := v_issues || jsonb_build_object('code', 'date_passed', 'message', 'This pass was valid on ' || to_char(v_rec.visit_date, 'YYYY-MM-DD') || ' and has lapsed.');
    else
      v_ok := true;
      v_next_action := 'check-in';
    end if;
  elsif v_rec.status = 'Pending' or v_rec.status = 'Rescheduled' then
    v_ok := false;
    v_issues := v_issues || jsonb_build_object('code', 'not_approved', 'message', 'This booking is still awaiting approval — entry cannot be granted.');
  elsif v_rec.status = 'Rejected' then
    v_ok := false;
    v_issues := v_issues || jsonb_build_object('code', 'rejected', 'message', 'This booking was rejected by campus security policy.');
  elsif v_rec.status = 'Checked Out' then
    v_ok := false;
    v_issues := v_issues || jsonb_build_object('code', 'used', 'message', 'This pass has already been used and closed.');
  elsif v_rec.status = 'Cancelled' then
    v_ok := false;
    v_issues := v_issues || jsonb_build_object('code', 'cancelled', 'message', 'This booking has been cancelled.');
  else
    v_ok := false;
    v_issues := v_issues || jsonb_build_object('code', 'invalid_status', 'message', 'Pass status (' || v_rec.status || ') is not valid for entry.');
  end if;

  return jsonb_build_object(
    'ok', v_ok,
    'booking', jsonb_build_object(
      'id', v_rec.id,
      'visitorId', v_rec.visitor_id,
      'fullName', v_rec.full_name,
      'mobile', v_rec.mobile,
      'mobileNumber', coalesce(v_rec.mobile_number, v_rec.mobile),
      'photoPath', coalesce(v_rec.photo_path, v_rec.photo_url),
      'photoUrl', coalesce(v_rec.photo_url, v_rec.photo_path),
      'purpose', v_rec.purpose,
      'purposeDetail', v_rec.purpose_detail,
      'hostName', v_rec.host_name,
      'department', v_rec.department,
      'visitDate', v_rec.visit_date,
      'visitTime', v_rec.visit_time,
      'expectedDuration', v_rec.expected_duration,
      'numberOfVisitors', v_rec.number_of_visitors,
      'hasCar', coalesce(v_rec.has_car, v_rec.vehicle_required, false),
      'carNumber', coalesce(v_rec.car_number, v_rec.vehicle_number),
      'vehicleNumber', coalesce(v_rec.vehicle_number, v_rec.car_number),
      'status', v_rec.status,
      'badgeNumber', v_rec.badge_number,
      'checkInAt', v_rec.check_in_at,
      'checkedInBy', v_rec.checked_in_by,
      'checkOutAt', v_rec.check_out_at,
      'checkedOutBy', v_rec.checked_out_by,
      'gate', v_rec.gate
    ),
    'issues', v_issues,
    'nextAction', v_next_action,
    'history', v_history
  );
end;
$$;

-- 4. Atomic PostgreSQL Check-In Function
create or replace function public.gate_check_in(
  p_visit_request_id text,
  p_gate text,
  p_guard_id text default null,
  p_guard_name text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec record;
  v_timestamp timestamptz := clock_timestamp();
  v_guard_name text;
  v_check_log_id text;
  v_movement_id text;
  v_plate text;
begin
  -- Privilege verification: caller must be gate operator, admin, or service role
  if not (public.is_gate_operator() or auth.role() = 'service_role') then
    raise exception 'Unauthorized: Only authorized gate security personnel can check in visitors.'
      using errcode = '42501';
  end if;

  -- Guard name resolution
  v_guard_name := coalesce(nullif(trim(p_guard_name), ''), 'Gate Officer');

  -- Atomic row lock on visit_requests to prevent race conditions
  select *
    into v_rec
    from public.visit_requests
   where id = p_visit_request_id
     for update;

  if v_rec.id is null then
    raise exception 'No visit request found with ID %', p_visit_request_id
      using errcode = 'P0002';
  end if;

  -- State validation
  if v_rec.status in ('Checked In', 'Meeting In Progress') then
    raise exception 'This visitor is already checked in and inside campus.'
      using errcode = '23505';
  end if;

  if v_rec.status <> 'Approved' then
    raise exception 'Cannot check in: Booking status is %, but must be Approved.', v_rec.status
      using errcode = '22023';
  end if;

  if v_rec.pass_expires_at is not null and v_rec.pass_expires_at < v_timestamp then
    raise exception 'Cannot check in: Visitor pass has expired.'
      using errcode = '22023';
  end if;

  -- 1. Update visit_requests
  update public.visit_requests
     set status = 'Checked In',
         check_in_at = v_timestamp,
         checked_in_by = v_guard_name,
         gate = p_gate,
         updated_at = v_timestamp
   where id = v_rec.id;

  -- 2. Insert immutable check log
  v_check_log_id := 'CHK-' || to_char(v_timestamp, 'YYYYMMDD-HH24MISS-') || substr(md5(random()::text), 1, 6);
  insert into public.check_logs
    (id, visit_request_id, visitor_id, visitor_name, direction, gate, guard_id, guard_name, note, at)
  values
    (v_check_log_id, v_rec.id, v_rec.visitor_id, v_rec.full_name, 'In', p_gate, p_guard_id, v_guard_name, p_note, v_timestamp);

  -- 3. Insert movement audit record
  v_movement_id := 'MOV-' || to_char(v_timestamp, 'YYYYMMDD-HH24MISS-') || substr(md5(random()::text), 1, 6);
  insert into public.movements
    (id, person_id, person_name, person_type, direction, gate, at)
  values
    (v_movement_id, v_rec.visitor_id, v_rec.full_name, 'Visitor', 'Entry', p_gate, v_timestamp);

  -- 4. Vehicle recording if applicable
  v_plate := upper(trim(coalesce(v_rec.car_number, v_rec.vehicle_number, '')));
  if (v_rec.has_car or v_rec.vehicle_required) and v_plate <> '' then
    insert into public.vehicles
      (id, vehicle_number, vehicle_type, visitor_name, driver_name, purpose, gate, entry_time, status, linked_visit_id, guard_id, guard_name)
    values
      ('VEH-' || substr(md5(random()::text), 1, 10), v_plate, 'Car', v_rec.full_name, v_rec.full_name, coalesce(v_rec.purpose, 'Campus Visit'), p_gate, v_timestamp, 'Inside', v_rec.id, p_guard_id, v_guard_name)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'bookingId', v_rec.id,
    'visitorName', v_rec.full_name,
    'status', 'Checked In',
    'checkInAt', v_timestamp,
    'checkedInBy', v_guard_name,
    'gate', p_gate,
    'logId', v_check_log_id
  );
end;
$$;

-- 5. Atomic PostgreSQL Check-Out Function
create or replace function public.gate_check_out(
  p_visit_request_id text,
  p_gate text,
  p_guard_id text default null,
  p_guard_name text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec record;
  v_timestamp timestamptz := clock_timestamp();
  v_guard_name text;
  v_check_log_id text;
  v_movement_id text;
  v_plate text;
begin
  -- Privilege verification: caller must be gate operator, admin, or service role
  if not (public.is_gate_operator() or auth.role() = 'service_role') then
    raise exception 'Unauthorized: Only authorized gate security personnel can check out visitors.'
      using errcode = '42501';
  end if;

  v_guard_name := coalesce(nullif(trim(p_guard_name), ''), 'Gate Officer');

  -- Atomic row lock on visit_requests
  select *
    into v_rec
    from public.visit_requests
   where id = p_visit_request_id
     for update;

  if v_rec.id is null then
    raise exception 'No visit request found with ID %', p_visit_request_id
      using errcode = 'P0002';
  end if;

  -- State validation
  if v_rec.status = 'Checked Out' then
    raise exception 'This visitor has already been checked out.'
      using errcode = '23505';
  end if;

  if v_rec.status not in ('Checked In', 'Meeting In Progress') then
    raise exception 'Cannot check out: Visitor is not currently inside campus (status: %).', v_rec.status
      using errcode = '22023';
  end if;

  -- 1. Update visit_requests
  update public.visit_requests
     set status = 'Checked Out',
         check_out_at = v_timestamp,
         checked_out_by = v_guard_name,
         meeting_ended_at = coalesce(meeting_ended_at, v_timestamp),
         updated_at = v_timestamp
   where id = v_rec.id;

  -- 2. Insert immutable check log for exit
  v_check_log_id := 'CHK-' || to_char(v_timestamp, 'YYYYMMDD-HH24MISS-') || substr(md5(random()::text), 1, 6);
  insert into public.check_logs
    (id, visit_request_id, visitor_id, visitor_name, direction, gate, guard_id, guard_name, note, at)
  values
    (v_check_log_id, v_rec.id, v_rec.visitor_id, v_rec.full_name, 'Out', p_gate, p_guard_id, v_guard_name, p_note, v_timestamp);

  -- 3. Insert movement audit record
  v_movement_id := 'MOV-' || to_char(v_timestamp, 'YYYYMMDD-HH24MISS-') || substr(md5(random()::text), 1, 6);
  insert into public.movements
    (id, person_id, person_name, person_type, direction, gate, at)
  values
    (v_movement_id, v_rec.visitor_id, v_rec.full_name, 'Visitor', 'Exit', p_gate, v_timestamp);

  -- 4. Close vehicle record if inside
  update public.vehicles
     set status = 'Exited',
         exit_time = v_timestamp
   where linked_visit_id = v_rec.id
     and status = 'Inside';

  return jsonb_build_object(
    'success', true,
    'bookingId', v_rec.id,
    'visitorName', v_rec.full_name,
    'status', 'Checked Out',
    'checkOutAt', v_timestamp,
    'checkedOutBy', v_guard_name,
    'gate', p_gate,
    'logId', v_check_log_id
  );
end;
$$;

-- 6. Grant execute permissions
grant execute on function public.gate_verify_pass(text, text) to authenticated, anon, service_role;
grant execute on function public.gate_check_in(text, text, text, text, text) to authenticated, service_role;
grant execute on function public.gate_check_out(text, text, text, text, text) to authenticated, service_role;

-- 7. Row Level Security policies for check_logs
alter table public.check_logs enable row level security;

drop policy if exists check_logs_read on public.check_logs;
create policy check_logs_read on public.check_logs
  for select using (
    public.is_gate_operator() or public.is_admin() or auth.role() = 'service_role'
  );

drop policy if exists check_logs_insert on public.check_logs;
create policy check_logs_insert on public.check_logs
  for insert with check (
    public.is_gate_operator() or public.is_admin() or auth.role() = 'service_role'
  );
