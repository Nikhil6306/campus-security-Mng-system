# Final Guard Registration, Supabase Integration & Role-Based Access Audit

**Date:** 2026-11-27  
**Project:** Dev Sanskriti Vishwavidyalaya (DSVV) — Campus Security Management System (CSMS)  
**Production URL:** `https://campus-security-management.vercel.app`  
**Android Package ID:** `com.dsvv.campussecurity` (`Security`)

---

## 1. Root Cause of Guard Registration Failure

When testing the Android APK on the USB-connected phone (`1A19263210BA09GU`), submitting the 4-field Guard Registration form returned:

> `"Registration failed. Please check inputs and try again."`

### Confirmed Root Causes
1. **Production Vercel Deployment Out of Sync (`HTTP 405 Method Not Allowed`):**  
   Live probe against `https://campus-security-management.vercel.app/api/guards/register` returned:
   - `HTTP/1.1 405 Method Not Allowed`
   - `X-Matched-Path: /api/guards/[id]`
   - `Content-Length: 0`  
   Because `origin/main` (deployed on Vercel) did not yet contain the updated `app/api/guards/register/route.ts` route (and previously required `guardId`), `POST /api/guards/register` matched `/api/guards/[id]` with `id="register"`, which has no `POST` handler and returned an empty `405` body. The mobile client's `res.json().catch(() => ({}))` then fell back to `"Registration failed. Please check inputs and try again."`.
2. **Missing Supabase Persistence in `lib/server/services/guards.ts`:**  
   `createGuardRegistrationRequest`, `approveGuardRegistration`, `rejectGuardRegistration`, `suspendGuardAccount`, and `reactivateGuardAccount` previously wrote only to local SQLite (`/tmp` on Vercel serverless) without persisting to Supabase (`guard_registration_requests`, `security_guards`, `profiles`, `auth.users`).
3. **Missing `guard_registration_requests` Pull in `syncFromSupabase()`:**  
   `lib/server/supabase-db.ts` synced 14 tables from Supabase but did not sync `guard_registration_requests`.

---

## 2. Exact Files Modified

| File | Purpose |
|---|---|
| `lib/server/supabase-db.ts` | Added `guard_registration_requests` sync in `syncFromSupabase()` |
| `lib/server/services/guards.ts` | Added `createGuardRegistrationRequestAsync`, `approveGuardRegistrationAsync`, `rejectGuardRegistrationAsync`, `suspendGuardAccountAsync`, `reactivateGuardAccountAsync`, plus `persistSecondaryToSupabase` on `createGuard`/`updateGuard`/`deleteGuard`; wrapped SQLite duplicate checks inside `tx()` |
| `lib/server/auth.ts` | Updated `signIn()` to check both SQLite and Supabase `guard_registration_requests` for `PENDING`/`REJECTED`/`SUSPENDED` status even if `profiles.active = false` or `signInWithPassword` fails |
| `app/api/guards/register/route.ts` | Switched to `await createGuardRegistrationRequestAsync(...)` for Supabase persistence |
| `app/api/guards/registrations/route.ts` | Restricted `GET` to `ADMIN_ROLES`; preferred Supabase as source of truth with field-whitelist sanitisation; wired `PATCH` to async Supabase-persisting approval/rejection/suspension/reactivation functions |
| `app/api/guards/status/route.ts` | Added session authentication (`401`) and self-query restriction (`403` for non-admins querying other emails) |
| `mobile/src/services/api.ts` | Improved HTTP error reporting (`Registration failed (HTTP ${res.status})...`) and added `resendPasswordResetOtp`, `verifyPasswordResetOtp`, `resetPasswordWithToken` |
| `mobile/app/forgot-password.tsx` & `mobile/src/app/forgot-password.tsx` | Implemented full 4-step Email OTP Forgot Password & New Password flow |

---

## 3. Bugs Fixed

1. **Missing Supabase persistence for Guard Registrations & Approvals** — Fixed via async Supabase persistence + `admin.auth.admin.createUser` (locked with `profiles.active = false` until Admin approval).
2. **Public PII leak on `GET /api/guards/status`** — Fixed with `currentSession()` + self-only check.
3. **Privilege leak on `GET /api/guards/registrations`** — Changed from `GATE_ROLES` to `ADMIN_ROLES`.
4. **Raw Supabase row exposure (`password_hash`/`password_salt`)** — Added explicit field-whitelist mapping.
5. **Concurrent registration TOCTOU race** — Moved SQLite duplicate checks inside `tx()`, plus Supabase pre-checks in `createGuardRegistrationRequestAsync`.
6. **Opaque mobile registration error on non-JSON HTTP failures** — Surfaces HTTP status code cleanly.

---

## 4. Supabase Database & RLS Status

- **Migration `0020_guard_registration_requests.sql`:** Present in repo with `guard_registration_requests` table, `status` check constraint, `email` unique constraint, RLS enabled, and policies for Admin full access, Guard self-read, and anon/authenticated insert.
- **Migration `0019_password_reset_otps.sql`:** Present in repo with RLS denying `anon`/`authenticated` reads.
- **Role-Based Access (`middleware.ts` + `lib/server/http.ts`):**
  - `super_admin` → `/administrator/dashboard`
  - `admin` → `/admin/dashboard` (`ADMIN_ROLES`)
  - `security` → `/security/dashboard` (`GATE_ROLES`)
  - `teacher` → `/teacher/dashboard` (`STAFF_ROLES`)
  - `student` → `/student`
  - `visitor` → `/visitor`
  - All sensitive APIs enforce `requireRole(...)` server-side.

---

## 5. Verification & Test Results

### Local Automated Checks
| Check | Result | Scope / Notes |
|---|---|---|
| `npm run typecheck` | **PASS** (0 errors) | Local TypeScript |
| `npm run typecheck --prefix mobile` | **PASS** (0 errors) | Mobile TypeScript |
| `npm run lint` | **PASS** (0 errors, 142 pre-existing warnings) | ESLint |
| `tests/guard-authentication-and-approval.mjs` | **PASS** (11 / 11) | Local SQLite guard registration, approval, suspension, rejection, 4-field & duplicate mobile tests |
| `tests/offline-persistence.mjs` | **PASS** (40 / 40) | Offline outbox & network classification |
| `tests/gate-in-out-workflow.mjs` | **PASS** (6 / 6) | QR payload, SHA-256 pass token, check-in/out |
| `tests/email-service.mjs` | **PASS** (1 / 1) | Resend provider safety |
| `tests/supabase-migration-safety.mjs` | **PASS** (1 / 1) | RLS policy verification |
| `tests/deployment-config.mjs` | **PASS** | Deployment config checks |
| `tests/unit.mjs` | **51 / 52 PASS** (1 time-of-day failure) | `booking a future time today is allowed` failed because local test ran at `00:00 IST` (outside `07:00–20:00` visiting hours) |

### Connected Physical Android Device Verification
- **ADB Device:** `1A19263210BA09GU` (`RMX3263`, status: `device`)
- **APK Build:** `.\gradlew.bat assembleRelease --no-daemon` → `BUILD SUCCESSFUL in 3m 48s`
- **APK Artifact:** `mobile/android/app/build/outputs/apk/release/Security.apk` (`54,872,423` bytes)
- **ADB Install:** `adb -s 1A19263210BA09GU install -r "...\Security.apk"` → `Performing Streamed Install` / `Success`
- **App Launch:** `adb -s 1A19263210BA09GU shell am start -n com.dsvv.campussecurity/.MainActivity` → `PID: 23800`, 0 `FATAL`/`AndroidRuntime`/`ReactNativeJS` errors in `logcat`.

---

## 6. Remaining Production Deployment Steps (Required Before Live Phone Registration Succeeds)

Because the updated `Security.apk` connects to `https://campus-security-management.vercel.app`, the live backend **must** be updated with these fixes:

1. **Push updated local commits to `origin/main`** (triggers Vercel production deployment so `/api/guards/register` is live instead of `405`).
2. **Verify Migration `0020_guard_registration_requests.sql` is applied in Production Supabase** (run in Supabase SQL Editor if not yet applied).
3. **Verify Vercel Environment Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
4. **Manual On-Device Test:** Once Vercel finishes deploying, test Guard Registration, Email OTP, Admin Approval, Guard Sign In, QR Scan, and Check-In/Out on the phone.
