# Admin Login Database Fix & Verification Report

**Project:** Dev Sanskriti Vishwavidyalaya — Campus Security Management System (CSMS)  
**Supabase Project ID:** `qpamgfhggxwctoibmsbl`  
**Production URL:** `https://campus-security-management.vercel.app`  
**Local URL:** `http://localhost:3000`  
**Date:** 2026-11-27  

---

## 1. Original Root Cause

During `signInWithPassword` in Supabase Auth:
1. Supabase Auth updates `auth.users.last_sign_in_at`.
2. The `on_auth_user_login` trigger on `auth.users` executes `public.handle_user_login()`, which updates `public.profiles` (`last_login_at` and `updated_at`).
3. `trg_check_admin_role_email` (`BEFORE INSERT OR UPDATE ON public.profiles`) executes `public.check_admin_role_email()`.
4. In migration `0009_admin_email_restriction.sql`, `check_admin_role_email()` rejected every `INSERT` or `UPDATE` where `new.role IN ('admin', 'super_admin')` and `lower(trim(new.email)) <> 'nikhilshukla1200@gmail.com'`.
5. Consequently, signing in as `superadmin@dsvv.edu.in` or `admin@dsvv.edu.in` caused `handle_user_login()` to raise `'Access denied. This email is not authorized to receive administrator privileges.'`, which Supabase Auth surfaced as **`Database error granting user`**.

Migration `0022_fix_admin_email_trigger.sql` (already deployed on `qpamgfhggxwctoibmsbl`) expanded the allowlist in `check_admin_role_email()` to include `superadmin@dsvv.edu.in` and `admin@dsvv.edu.in`, resolving the immediate sign-in failure. However:
- `0022` still ran the email allowlist check on **every** `UPDATE` (including `last_login_at` and `updated_at`), rather than only when `role` or `email` changes.
- `0022` did not explicitly `DROP TRIGGER IF EXISTS` / `CREATE TRIGGER` for `trg_check_admin_role_email`.

---

## 2. Exact Database Objects Involved

- **Table:** `public.profiles` (`id`, `email`, `full_name`, `role`, `ref_id`, `gate`, `active`, `last_login_at`, `updated_at`)
- **Auth Table:** `auth.users` (`last_sign_in_at`)
- **Triggers:**
  - `on_auth_user_created` (`AFTER INSERT ON auth.users`) -> `public.handle_new_user()`
  - `on_auth_user_login` (`AFTER UPDATE ON auth.users`) -> `public.handle_user_login()`
  - `trg_check_admin_role_email` (`BEFORE INSERT OR UPDATE ON public.profiles`) -> `public.check_admin_role_email()`
- **Functions:**
  - `public.check_admin_role_email()` (`SECURITY DEFINER`, `SET search_path = public, pg_temp`)
  - `public.is_admin()` (`SECURITY DEFINER`, `STABLE`, `SET search_path = public, pg_temp`)
  - `public.handle_user_login()` (`SECURITY DEFINER`, `SET search_path = public, pg_temp`)
  - `public.handle_new_user()` (`SECURITY DEFINER`, `SET search_path = public, pg_temp`)
- **RLS Policies on `public.profiles`:**
  - `profiles_self_read`
  - `profiles_self_update` (prevents self-modification of `role`, `ref_id`, `active`)
  - `profiles_admin_write` (`public.is_admin()`)

---

## 3. Files and Migrations Modified

- **Created / Updated:** [0023_fix_admin_login_trigger.sql](file:///c:/Users/DELL/campus%20security%20mangement%20system/supabase/migrations/0023_fix_admin_login_trigger.sql)
  - Updates `public.check_admin_role_email()` so the admin email allowlist check runs on:
    - `INSERT`, or
    - `UPDATE` when `new.role IS DISTINCT FROM old.role`, or
    - `UPDATE` when `lower(trim(new.email)) IS DISTINCT FROM lower(trim(old.email))`.
  - Allows normal profile updates (`last_login_at`, `updated_at`, `full_name`, etc.) without unnecessary trigger blocking.
  - Drops and recreates `trg_check_admin_role_email` on `public.profiles`.
  - Keeps `public.is_admin()` as `SECURITY DEFINER`, `STABLE`, `SET search_path = public, pg_temp` checking `p.active AND p.role IN ('admin', 'super_admin')`.
  - Includes idempotent role/active verification updates for `superadmin@dsvv.edu.in` and `admin@dsvv.edu.in`.

---

## 4. Migration Application Status

- **Applied to `qpamgfhggxwctoibmsbl`?** **BLOCKED (Not yet applied to live Supabase)**
- **Reason:**
  - Direct PostgreSQL connections failed from this machine (`db.qpamgfhggxwctoibmsbl.supabase.co:5432` -> `ENOTFOUND`; `aws-0-ap-southeast-1.pooler.supabase.com:5432` and `:6543` -> `TIMEOUT`).
  - Browser automation to open `https://supabase.com/dashboard/project/qpamgfhggxwctoibmsbl/sql/new` was unavailable because Chrome remote debugging (`DevToolsActivePort`) is not active.
- **Note:** Migration `0022_fix_admin_email_trigger.sql` is already active on `qpamgfhggxwctoibmsbl`, which is why `superadmin@dsvv.edu.in` sign-in currently succeeds. Migration `0023` must still be executed in the Supabase SQL Editor to apply the `role`/`email` change-only trigger refinement and trigger recreation.

---

## 5. Before / After Trigger Behavior (`0023`)

| Operation on `public.profiles` | Before (`0009`) | Current Live (`0022`) | After (`0023`) |
|---|---|---|---|
| `INSERT` admin with authorized email | Only `nikhilshukla1200@gmail.com` allowed | Allows 3 admin emails | Allows 3 admin emails |
| `INSERT` admin with unauthorized email | Blocked | Blocked | Blocked |
| `UPDATE` `last_login_at` / `updated_at` for `superadmin@dsvv.edu.in` | **Blocked** (`Database error granting user`) | Allowed (re-checks allowlist) | Allowed (skips allowlist check) |
| `UPDATE` `role` to `admin`/`super_admin` for unauthorized email | Blocked | Blocked | Blocked |
| `UPDATE` `email` of an existing admin to unauthorized email | Blocked | Blocked | Blocked |

---

## 6. Admin Profile Verification Results (Live `qpamgfhggxwctoibmsbl`)

| Account | Auth User ID | Profile ID | Profile Role | Active | Email Confirmed | Status |
|---|---|---|---|---|---|---|
| `superadmin@dsvv.edu.in` | `9ba4fc21-4a2b-4b43-bd09-b0fff60187a1` | `9ba4fc21-4a2b-4b43-bd09-b0fff60187a1` | `super_admin` | `true` | Yes | **PASS** |
| `admin@dsvv.edu.in` | `35be3248-9c53-414c-8953-9bbafcf13dad` | `35be3248-9c53-414c-8953-9bbafcf13dad` | `admin` | `true` | Yes | **PASS** (mapping) / **BLOCKED** (login — password not provided) |
| `nikhilshukla1200@gmail.com` | `1a1bcd76-569a-41f7-8b2e-684fa6b66fe4` | `1a1bcd76-569a-41f7-8b2e-684fa6b66fe4` | `super_admin` | `true` | Yes | **PASS** (preserved) |

---

## 7. Localhost Test Results (`http://localhost:3000`)

| Test | Expected | Observed | Status |
|---|---|---|---|
| Unauthenticated `GET /api/activity` | `401` | `401` | **PASS** |
| Unauthenticated `GET /administrator/dashboard` | Redirect to `/administrator/login` | `307` -> `/administrator/login?next=%2Fadministrator%2Fdashboard` | **PASS** |
| Wrong-portal login (`superadmin@dsvv.edu.in` with `expectedRole: "admin"`) | `403` | `403` | **PASS** |
| Super Admin `POST /api/auth/login` (`expectedRole: "super_admin"`) | `200`, `role: "super_admin"` | `200`, `ok: true`, `role: "super_admin"` | **PASS** |
| Authenticated `GET /api/activity` | `200` | `200` | **PASS** |
| Authenticated `GET /administrator/dashboard` & `POST /api/auth/logout` | `200` | Server task cancelled during dashboard dev compilation | **NOT TESTED** |

---

## 8. Production Test Results (`https://campus-security-management.vercel.app`)

| Test | Expected | Observed | Status |
|---|---|---|---|
| `GET /api/public/directory` | `200` | `200` | **PASS** |
| Unauthenticated `GET /api/activity` | `401` | `401` | **PASS** |
| Super Admin `POST /api/auth/login` (`expectedRole: "super_admin"`) | `200`, `role: "super_admin"` | `200`, `ok: true`, `role: "super_admin"` | **PASS** |
| Authenticated `GET /api/activity` | `200` | `200` | **PASS** |
| Authenticated `GET /administrator/dashboard` | `200` | `200` | **PASS** |
| `POST /api/auth/logout` | `200` + session invalidated | `500` (subsequent `/api/activity` still returned `200`) | **FAIL** |

---

## 9. Security & Code Quality Verification Results

| Check | Result | Status |
|---|---|---|
| Supabase `signInWithPassword` (`superadmin@dsvv.edu.in`) | Authenticated without `Database error granting user` | **PASS** |
| Test C: Normal profile `updated_at` update on `superadmin@dsvv.edu.in` | Updated cleanly without trigger error | **PASS** |
| Test D: Unauthorized role assignment (live DB after `0023`) | Not executed on live DB (`0023` pending; avoided mutating prod accounts) | **NOT TESTED** |
| Test E: Unauthorized admin email change (live DB after `0023`) | Not executed on live DB (`0023` pending; avoided mutating prod accounts) | **NOT TESTED** |
| `npm run typecheck` | 0 errors | **PASS** |
| `npm run lint` | 0 errors (pre-existing warnings only) | **PASS** |
| `npm test` | All 7 test suites passed (52 + 40 + 1 + 1 + 6 + 11 + deployment-config) | **PASS** |

---

## 10. Remaining Manual Actions

1. **Apply migration `0023_fix_admin_login_trigger.sql` in Supabase SQL Editor:**
   - Open `https://supabase.com/dashboard/project/qpamgfhggxwctoibmsbl/sql/new`
   - Paste and run the contents of `supabase/migrations/0023_fix_admin_login_trigger.sql`.
2. **Investigate production `POST /api/auth/logout` HTTP 500:**
   - Check Vercel function logs for `/api/auth/logout` (likely `bootstrap()` / SQLite `DELETE FROM sessions` or `signOutToken` in serverless `/tmp`).
