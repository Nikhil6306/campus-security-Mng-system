# DSVV Campus Security Management System (CSMS)
## Guard Authentication, Admin Approval & Mobile QR Scanner Integration Report

**Date:** November 25, 2026  
**Application ID:** `com.dsvv.campussecurity`  
**Application Name / Launcher Label:** Security  
**Backend:** Next.js App Router (Node.js runtime), SQLite (WAL mode) with Outbox Sync, Supabase PostgreSQL with RLS  
**Mobile Framework:** React Native 0.86.3 / Expo SDK 57 (Standalone Embedded Hermes Bytecode)  
**Target Hardware Tested:** Realme RMX3263 (Android 11, ARM64, Serial: `1A19263210BA09GU`)  

---

## 1. Executive Summary

A complete, production-grade **Guard Authentication and Admin Approval System** has been designed, implemented, verified, and deployed to physical Android hardware.

### Key Capabilities Delivered
1. **Guard Self-Registration (Mobile & Web API):** New security guards can register directly on the mobile app or web portal. The system securely hashes their credentials using cryptographic scrypt (`N=16384`) with unique random salt per user, assigns their post/gate, and records their application in status `PENDING`.
2. **Strict Pre-Approval Security Gate:** Login attempts by unregistered, pending, rejected, or suspended guards are strictly rejected at the server boundary with HTTP 403 status codes and clear informational notices. No unapproved user can ever obtain a gate session or access the dashboard.
3. **Web Admin Dashboard ("Guard Management"):** A dedicated 4-tab interface allows Chief Security Officers and administrators to:
   - **Tab 1: Pending Requests:** Review applicant details (name, employee ID, phone, email, assigned gate, designation, submission date) with one-click **Approve** and **Reject** (with optional reason modal).
   - **Tab 2: Approved Guards:** Manage the live gate roster with gate posts, shifts, real-time counters (today's check-ins, check-outs, and incidents), and **Suspend** buttons.
   - **Tab 3: Rejected Requests:** Audit historical declined applications and reason notes.
   - **Tab 4: Suspended Guards:** Audit suspended guards with instant **Re-activate** capabilities.
4. **Atomic Transactional Account Activation:** Approving a guard atomically:
   - Creates or updates their roster entry in `security_guards`.
   - Provisions their authenticated identity in `app_users` with role `'security'` and `active = 1`.
   - Links `app_users.ref_id` to `security_guards.id`.
   - Marks `guard_registration_requests.status = 'APPROVED'` with audit logs.
   - Syncs schema and state to Supabase PostgreSQL when configured.
   - Triggers an automated, branded HTML approval notification email via the email service (`lib/server/services/email.ts`).
5. **Mobile Guard Application ("Security"):**
   - **Splash Screen:** Deep Navy (`#0A192F`) theme, gold accents, animated DSVV shield seal, automatic persistent session validation, and intelligent routing.
   - **Guard Login Screen:** Email, password with eye toggle, "Forgot Password?", "New Guard? Register Account" button, dedicated warning cards for `PENDING`, `REJECTED`, and `SUSPENDED` accounts, and persistent local session management.
   - **Guard Registration Screen:** Complete registration form for Full Name, Work Email, Mobile Number (10 digits), Guard ID, Password & Confirm Password (with visibility toggles), Designation chips, and Gate selector chips. Displays dedicated confirmation screen awaiting Admin review upon submission.
   - **Guard Dashboard:** Duty Officer header, On Duty / Standby toggle, live campus visitor metrics (Total today, Currently inside, Vehicles inside, Active alerts), and operational action grid.
   - **Camera QR Pass Scanner & Gate Verification:** Camera-based QR pass scanning, server-side cryptographic token validation against `/api/gate/verify`, visitor photo & pass details card, and check-in / check-out actions against `/api/gate/check-in` and `/api/gate/check-out`.
6. **Full Verification:** All 146 automated tests pass with 0 failures, TypeScript typechecks with 0 errors, Gradle builds `Security.apk` (`105,968,254 bytes`) cleanly in 2m 34s, and the APK was streamed and verified on the attached Realme physical phone.

---

## 2. Architecture & Data Flow

```
[ New Guard on Phone ]
         |
         | 1. POST /api/guards/register
         v
[ Next.js API / SQLite Database ]
  - Hashes password (scrypt + unique salt)
  - Inserts into guard_registration_requests (status: 'PENDING')
         |
         | 2. Guard attempts login before approval -> 403 Forbidden
         |    ("Account Pending Approval - Waiting for Administrator Review")
         v
[ Web Admin Dashboard (/admin/guards) ]
  - Admin reviews "Pending Requests" tab
  - Admin clicks "Approve" (selects Gate & Shift)
         |
         | 3. Atomic Transaction (tx)
         |    - Inserts security_guards roster row
         |    - Inserts app_users account (role: 'security', active: 1)
         |    - Updates request status: 'APPROVED'
         |    - Dispatches approval email with login instructions
         v
[ Approved Guard on Phone ]
         |
         | 4. POST /api/auth/login -> 200 OK (role: 'security')
         |    - Stored locally in appStorage for persistent auto-login
         v
[ Guard Gate Dashboard ]
  - On Duty / Off Duty toggle
  - Live visitor stats
  - QR Scanner (/scan) -> Server Verification (/api/gate/verify) -> Check-In / Check-Out
```

---

## 3. Database Schema

### SQLite Table: `guard_registration_requests`
```sql
CREATE TABLE IF NOT EXISTS guard_registration_requests (
  id               TEXT PRIMARY KEY,
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  phone            TEXT NOT NULL,
  guard_id         TEXT NOT NULL,
  designation      TEXT NOT NULL DEFAULT 'Security Guard',
  assigned_gate    TEXT NOT NULL DEFAULT 'Main Gate',
  password_hash    TEXT NOT NULL,
  password_salt    TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  rejection_reason TEXT,
  created_at       TEXT NOT NULL,
  reviewed_at      TEXT,
  reviewed_by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_guard_req_status ON guard_registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_guard_req_email ON guard_registration_requests(email);
```

### Supabase PostgreSQL Migration: `supabase/migrations/0020_guard_registration_requests.sql`
- Creates table `public.guard_registration_requests` with matching structure.
- RLS enabled with policies:
  - Admins / Super Admins have full access.
  - Guards can read their own registration status.
  - Anonymous / authenticated users can insert registration requests.

---

## 4. API Endpoints

| Endpoint | Method | Access | Purpose |
| :--- | :---: | :---: | :--- |
| `/api/guards/register` | `POST` | Public | Submits new guard registration with status `PENDING`. |
| `/api/guards/status` | `GET` | Public / Authed | Checks guard registration status by email (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`). |
| `/api/guards/registrations` | `GET` | Admin / Security | Lists registration requests filtered by `?status=PENDING\|APPROVED\|REJECTED\|SUSPENDED\|all`. |
| `/api/guards/registrations` | `PATCH` | Admin | Performs `approve`, `reject`, `suspend`, or `reactivate` actions. |
| `/api/auth/login` | `POST` | Public | Authenticates credentials; checks `guard_registration_requests` for pending/rejected/suspended status before rejecting unapproved guards. |
| `/api/gate/verify` | `POST` | Guard / Admin | Verifies scanned QR token or booking ID against database. |
| `/api/gate/check-in` | `POST` | Guard / Admin | Records gate entry with guard ID and timestamp. |
| `/api/gate/check-out` | `POST` | Guard / Admin | Records gate exit with guard ID and timestamp. |

---

## 5. Web Admin Dashboard Guard Management

File: `app/admin/guards/page.tsx`
- **4 Operational Tabs:**
  1. **Pending Requests:** Lists pending applicant cards with name, guard ID, email, phone, applied date, assigned gate, and a "Review" button opening `GuardApprovalDialog` with Gate/Shift assignment and Approve/Reject buttons.
  2. **Approved Guards:** Active guard roster with real-time filters (Gate, Shift), counters for today's check-ins, check-outs, and incidents, View Profile, Edit, and **Suspend** buttons.
  3. **Rejected Requests:** Dedicated audit view of declined applications with administrative rejection reasons.
  4. **Suspended Guards:** Dedicated view of deactivated guards with instant **Re-activate** capability that restores their access.
- **Stat Cards:**
  - On roster (Total guards)
  - On duty now
  - Pending requests (with tone alert when > 0)
  - Suspended guards

---

## 6. Android Mobile Application Features

File: `mobile/src/app/` (mirrored in `mobile/app/`)
1. **Splash Screen (`index.tsx`):**
   - Theme: `#0A192F` dark navy, gold `#F59E0B` divider.
   - Branding: "SECURITY", "CAMPUS SECURITY", "Dev Sanskriti Vishwavidyalaya".
   - Auto-login check: Restores session via `restoreGuardSession()`. If active, navigates directly to `/dashboard`.
   - Portal buttons: "Sign In with Guard Credentials" and "Register New Guard Account".
2. **Guard Login Screen (`login.tsx`):**
   - Work email and password fields with visibility toggle.
   - "New campus security guard? Register New Guard Account" button.
   - Persistent session storage in `appStorage`.
   - Informational cards for:
     - `Account Pending Approval`: Warning card notifying the guard that their account awaits review.
     - `Registration Not Approved`: Explanatory card with reason and contact info (`security@dsvv.ac.in`).
     - `Account Suspended`: Notice directing guard to the Chief Security Officer.
3. **Guard Registration Screen (`register.tsx`):**
   - Inputs: Full Name, Official Work Email, Mobile Number (10 digits), Guard ID, Designation selector, Gate selector, Password, and Confirm Password.
   - Confirmation Screen: Clean success card with guard summary, status badge `PENDING APPROVAL`, and return button.
4. **Guard Dashboard (`dashboard.tsx`):**
   - Top banner: DSVV title, gate name, duty status badge (`ON DUTY` / `STANDBY`), and "Start Active Shift" / "End Shift & Handover" toggle.
   - Real-time Gate Statistics: Total visitors today, on-campus now, vehicles inside, active alerts.
   - Security Operations Tiles:
     - Scan visitor QR (`/scan`)
     - New check-in (`/check-in`)
     - Check-out (`/check-out`)
     - Visitor logs & history (`/history`)
     - Security alerts (`/notifications`)
     - Emergency SOS (`/emergency`)
5. **QR Code Scanner & Verification (`scan.tsx` & `verification.tsx`):**
   - Live camera view with framing reticle and flashlight toggle.
   - Verification against `/api/gate/verify`.
   - Detailed Visitor Card with name, host, department, purpose, pass validity badge, and vehicle details.
   - One-click "Confirm Check-In" and "Confirm Check-Out" buttons.
   - Handles edge cases: expired passes, already checked-in visitors, unapproved requests, and invalid tokens.

---

## 7. Verification & Build Results

### Automated Test Suite (`npm run test`)
```
====================================================
Suite 1: Visiting hours & Slot validation (52 tests)   -> PASSED
Suite 2: Offline-First Persistence & Outbox (40 tests) -> PASSED
Suite 3: Resend Email Service Provider Safety          -> PASSED
Suite 4: Supabase RLS Migration Safety                 -> PASSED
Suite 5: Gate In/Out Workflow & Security (6 tests)     -> PASSED
Suite 6: Guard Authentication & Approval (9 tests)     -> PASSED
Suite 7: Deployment Configuration Validation           -> PASSED
====================================================
TOTAL: 146 tests | PASSED: 146 | FAILED: 0
```

### TypeScript Validation (`npm run typecheck`)
- Command: `tsc --noEmit`
- Result: **0 errors** (Exit code 0).

### Android APK Build
- Command: `.\gradlew.bat assembleDebug -g D:\GradleCache --no-daemon`
- Pre-compiled Bundle: `mobile/android/app/src/main/assets/index.android.bundle` (Hermes bytecode: `5,221,996 bytes`)
- Result: `BUILD SUCCESSFUL in 2m 34s`
- Output APK: `mobile/android/app/build/outputs/apk/debug/Security.apk` (`105,968,254 bytes`)
- APK Application Label: `Security`
- Application ID: `com.dsvv.campussecurity`

### Physical Device Deployment & Launch
- Device: Realme RMX3263 (`1A19263210BA09GU`)
- Installation: `adb install -r mobile/android/app/build/outputs/apk/debug/Security.apk` -> **Success**
- Launch: `adb shell am start -n com.dsvv.campussecurity/.MainActivity` -> **Started**
- Screenshot verified: `mobile/android-screen.png` (240,942 bytes) displaying DSVV Security Portal.
