# Complete System Audit — DSVV Campus Security Management System

**Date:** 2026-11-27  
**Repository:** `https://github.com/Nikhil6306/campus-security-Mng-system`  
**Production URL:** `https://campus-security-management.vercel.app`  
**Mobile App:** `com.dsvv.campussecurity` (`Security`)

---

## 1. Executive Summary of Actual Bugs Found

1. **Vercel Production Stuck on Oct 29 Deployment (`dpl_GQ7z7QVVXBXVvudYwAfWCwZaAWVg`):**
   - `POST /api/auth/login` returned `HTTP 400 {"ok":false,"error":{"message":"unable to open database file","code":"bad_request"}}` because the Oct 29 deployment tried to open SQLite on Vercel's read-only filesystem instead of `/tmp` + Supabase.
   - `POST /api/guards/register` returned `HTTP 405 Method Not Allowed` (`X-Matched-Path: /api/guards/[id]`) because the Oct 29 deployment predated the guard registration route.
2. **Vercel Hobby Plan 12-Serverless-Function Limit Blocker:**
   - The repository contains **88** `app/api/**/route.ts` files.
   - Deploying via `vercel --prod` compiled cleanly but failed at the deploy stage:
     `No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.`
   - **Fix:** Consolidate all 88 API route handlers into a single Next.js 15 catch-all dispatcher (`app/api/[...route]/route.ts`) preserving every URL, HTTP method, dynamic param, auth guard, validation schema, and response format.
3. **Production Supabase Migrations Pending (`0019`, `0020`, and `0009` Duplicate Prefix):**
   - Live query against Supabase confirmed `public.guard_registration_requests` (`0020`) and `public.password_reset_otps` (`0019`) returned `PGRST205` (`404 Not Found`).
   - `supabase migration list` showed two files sharing version `0009` (`0009_admin_email_restriction.sql` and `0009_auth_profiles_and_roles.sql`), causing `supabase db push` to fail with `SQLSTATE 23505` on `schema_migrations_pkey`.
4. **Guard Registration & Approval Supabase Persistence Gap (Fixed in Code):**
   - `createGuardRegistrationRequestAsync`, `approveGuardRegistrationAsync`, `rejectGuardRegistrationAsync`, `suspendGuardAccountAsync`, and `reactivateGuardAccountAsync` added to persist to Supabase `guard_registration_requests`, `security_guards`, `profiles`, and `auth.users`.
5. **Email Infrastructure:**
   - The active backend email service is **Resend** (`lib/server/services/email.ts`), not EmailJS, using `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on the server only. No secrets are exposed in the APK or client bundle.
