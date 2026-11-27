-- ---------------------------------------------------------------------------
-- 0025 — Remove Aadhaar Card Columns (Phase 2 Data Minimization)
--
-- NOTE: Review and back up existing data before running against production.
-- Removes legacy Aadhaar-specific columns from visitors, visit_requests, and
-- visit_guests while preserving generic id_type / id_number fields.
-- ---------------------------------------------------------------------------

alter table public.visitors
  drop column if exists aadhaar_number;

alter table public.visit_requests
  drop column if exists aadhaar_number;

alter table public.visit_guests
  drop column if exists aadhaar_ciphertext,
  drop column if exists aadhaar_hash,
  drop column if exists aadhaar_last4;
