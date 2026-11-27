# Bug Fix Report — DSVV CSMS

**Date:** 2026-11-27

## Bugs Identified & Fixed

1. **HTTP 405 on Guard Registration (`POST /api/guards/register`)**
   - **Root Cause:** Vercel production was running a stale Oct 29 deployment without `/api/guards/register`, causing Next.js to match `/api/guards/[id]` (no `POST` handler).
   - **Fix:** Consolidated API routes and deployed latest backend to Vercel Production.

2. **Vercel Hobby 12-Serverless-Function Limit**
   - **Root Cause:** 88 separate `app/api/**/route.ts` files exceeded Hobby's 12-function limit.
   - **Fix:** Moved handlers to `lib/api-routes/**` and created `app/api/[...route]/route.ts` (1 Serverless Function).

3. **Cold-Start SQLite Seed Errors (`gate_staffing_requirements`, `patrol_routes`, `patrol_checkpoints`)**
   - **Root Cause:** `lib/server/seed.ts` referenced legacy column names (`required_guards`, `notes`, `description`, `zones`, `frequency`, `inspection_items`, `sort_order`) absent from `lib/server/schema.ts`.
   - **Fix:** Aligned `seed.ts` inserts with `schema.ts`.

4. **Vercel Production Pointed to Wrong Supabase Project & Missing Migrations**
   - **Root Cause:** Vercel env vars pointed to a separate integration project; `qpamgfhggxwctoibmsbl` was missing migrations `0010`–`0021` (`0009` had a duplicate prefix and `0012` lacked `extensions.digest`).
   - **Fix:** Synced Vercel prod env vars to `qpamgfhggxwctoibmsbl`, updated `lib/supabase.ts` env fallbacks, fixed `0012`/`0020`/`0021`, and pushed all migrations via `supabase db push --include-all`.

5. **`Database error granting user` on `superadmin@dsvv.edu.in` Login**
   - **Root Cause:** `trg_check_admin_role_email` (`0009_admin_email_restriction.sql`) blocked `on_auth_user_login` from updating `public.profiles.last_login_at` for `superadmin@dsvv.edu.in`.
   - **Fix:** Applied `0022_fix_admin_email_trigger.sql` allowing `superadmin@dsvv.edu.in`, `admin@dsvv.edu.in`, and `nikhilshukla1200@gmail.com`.

6. **Stateless Serverless OTP Persistence Gap (`lib/server/services/otp.ts`, `lib/server/auth.ts`)**
   - **Root Cause:** `password_reset_otps` and `rec-*` recovery tokens were stored only in local SQLite, which fails across separate Vercel lambdas.
   - **Fix:** Added Supabase `password_reset_otps` persistence/lookup/cooldown checks and HMAC-SHA256 signed stateless recovery tokens (`rec.<payload>.<sig>`), plus inactive/pending guard protection.

7. **Mobile Forgot Password & Error Reporting (`mobile/`)**
   - **Fix:** Added full 4-step Email OTP Forgot Password flow in `mobile/app/forgot-password.tsx` & `mobile/src/app/forgot-password.tsx`, and HTTP status error surfacing in `mobile/src/services/api.ts`.
