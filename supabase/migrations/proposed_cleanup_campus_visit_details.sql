-- ============================================================================
-- PROPOSED DATABASE MIGRATION (FOR REVIEW ONLY - DO NOT EXECUTE AUTOMATICALLY)
-- ============================================================================
-- Proposed Migration: Cleanup of Obsolete "Campus Visit Details" Columns
-- Target Table: public.visit_requests
-- Target Columns:
--   * host_id (uuid/text, references public.teachers)
--   * host_name (text)
--   * department_id (uuid/text, references public.departments)
--   * department (text)
--   * purpose (text)
--   * purpose_detail (text)
--   * purpose_meta (jsonb)
--   * notes (text)
--   * special_requirements (text)
--
-- Target Additive Columns (Already supported by new registration form):
--   * vehicle_type (text, nullable)
--   * expected_departure_time (text, nullable)
--
-- ----------------------------------------------------------------------------
-- SAFETY & DEPENDENCY ANALYSIS:
-- ----------------------------------------------------------------------------
-- 1. Foreign Keys:
--    * visit_requests_host_id_fkey: references public.teachers(id)
--    * visit_requests_department_id_fkey: references public.departments(id)
--
-- 2. Indexes & Constraints:
--    * uniq_host_slot: UNIQUE (host_id, visit_date, visit_time) WHERE host_id IS NOT NULL
--    * idx_visits_host: INDEX ON (host_id)
--
-- 3. Triggers & Notification Functions:
--    * 0004_faculty_notifications.sql:
--      Trigger on_visit_request_created invokes handle_visit_request_faculty_notification()
--      which inspects NEW.host_id.
--
-- 4. Application Dependencies:
--    * /admin/teachers: Computes teacher hosted meeting counts via visit.hostId
--    * /admin/requests: Filters and displays hostName, department, purpose
--    * /admin/meetings: Renders host appointment schedule
--    * /app/teacher/availability: Teacher availability portal where hosts manage bookings
--    * /security/scan & /security/dashboard: Displays hostName and department at gate
--    * lib/server/supabase-db.ts: syncFromSupabase() synchronizes these columns
--
-- ----------------------------------------------------------------------------
-- RECOMMENDATION:
-- Because the admin portal, faculty portal, security gate log, and sync code
-- still reference these fields for historical / desk / host appointments,
-- destructive removal from the production schema would break existing features.
--
-- The visitor registration form has already completely removed these fields
-- from its UI, client-side validation, and submission payload.
--
-- If the administrator explicitly decides to permanently deprecate faculty hosting
-- and department routing campus-wide, the following commands can be executed:
-- ============================================================================

-- STEP 1: Add new security fields to Supabase schema if not yet present
ALTER TABLE public.visit_requests
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS expected_departure_time text;

-- STEP 2: Make removed fields nullable (Safe non-destructive migration)
ALTER TABLE public.visit_requests
  ALTER COLUMN purpose DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- DESTRUCTIVE MIGRATION (ONLY EXECUTE WITH EXPLICIT HUMAN APPROVAL):
-- ----------------------------------------------------------------------------
/*
-- 1. Drop trigger and function for faculty notifications
DROP TRIGGER IF EXISTS on_visit_request_created ON public.visit_requests;
DROP FUNCTION IF EXISTS public.handle_visit_request_faculty_notification();

-- 2. Drop unique index and host index
DROP INDEX IF EXISTS public.uniq_host_slot;
DROP INDEX IF EXISTS public.idx_visits_host;

-- 3. Drop columns exclusively associated with the removed Campus Visit Details
ALTER TABLE public.visit_requests
  DROP COLUMN IF EXISTS host_id CASCADE,
  DROP COLUMN IF EXISTS host_name CASCADE,
  DROP COLUMN IF EXISTS department_id CASCADE,
  DROP COLUMN IF EXISTS department CASCADE,
  DROP COLUMN IF EXISTS purpose CASCADE,
  DROP COLUMN IF EXISTS purpose_detail CASCADE,
  DROP COLUMN IF EXISTS purpose_meta CASCADE,
  DROP COLUMN IF EXISTS notes CASCADE,
  DROP COLUMN IF EXISTS special_requirements CASCADE;
*/
