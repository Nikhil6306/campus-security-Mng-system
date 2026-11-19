# Campus Security Management System (CSMS)
## Quality Assurance & Automated Testing Report

**Institution:** Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar  
**Test Harness:** Node.js native test runners, TypeScript (`tsc --noEmit`), React 19, Next.js 15, React Native 0.86  
**Report Date:** November 2026

---

## 1. Test Suite Execution Summary

All core test suites were executed directly against the live project implementation.

| Test Suite File | Domain / Focus Area | Tests Executed | Passed | Failed | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `tests/unit.mjs` | Timezone helpers, visiting hours, slot grids, WhatsApp normalization, CSV sanitization, Supabase sync | 52 | 52 | 0 | **100% PASS** |
| `tests/rbac-auth.mjs` | Role-based redirection, dedicated login portals, cross-portal denials, 403 checks, API `requireRole` | 28 | 28 | 0 | **100% PASS** |
| `tests/guard-duty-handover.mjs` | Shift assignments, active sessions, handovers, supervisor reviews, staffing gap calculations | 21 | 21 | 0 | **100% PASS** |
| `tests/whatsapp-faculty-approval.mjs` | Cryptographic single-use tokens, approval replay blocking, webhook HMAC verification, pass issuance | 18 | 18 | 0 | **100% PASS** |
| `tests/gate-in-out-workflow.mjs` | Gate QR verification, atomic IN/OUT transitions, duplicate scan prevention, header sanitization | 6 | 6 | 0 | **100% PASS** |
| `npm run typecheck` | Web App TypeScript type compliance (`tsc --noEmit`) | Full Project | — | 0 Errors | **PASS** |
| `mobile (tsc --noEmit)` | Mobile App TypeScript type compliance (`cd mobile && npx tsc --noEmit`) | Full App | — | 0 Errors | **PASS** |
| **Combined Core Tests** | **Automated Regression Test Suite** | **125** | **125** | **0** | **100% PASS** |

---

## 2. Detailed Breakdown of Test Suites

### 2.1 Role-Based Access Control (RBAC) & Authentication (`tests/rbac-auth.mjs`)
* **Scenario 1:** Super Admin logs in via `/super-admin/login` and redirects to `/super-admin/dashboard` (**PASS**).
* **Scenario 2:** Admin logs in via `/admin/login` and redirects to `/admin/dashboard` (**PASS**).
* **Scenario 3:** Security Guard logs in via `/security/login` and redirects to `/security/dashboard` (**PASS**).
* **Scenario 4 (Cross-Role Denials):**
  * Admin attempting to log in via `/super-admin/login` is rejected with HTTP 403 (**PASS**).
  * Security Guard attempting to log in via `/super-admin/login` is rejected with HTTP 403 (**PASS**).
  * Security Guard attempting to log in via `/admin/login` is rejected with HTTP 403 (**PASS**).
  * Admin attempting to log in via `/security/login` is rejected with HTTP 403 (**PASS**).
  * Super Admin attempting to log in via `/admin/login` is rejected with HTTP 403 (**PASS**).
  * Super Admin attempting to log in via `/security/login` is rejected with HTTP 403 (**PASS**).
* **Scenario 4b (Authenticated Redirect):** Logged-in users re-visiting login pages are automatically redirected to their appropriate home dashboard (**PASS**).
* **Scenario 4c (Safe `next` Param):** Disallows cross-role redirection leaks via query parameters (**PASS**).
* **Scenario 5 (Protected URL Direct Access):**
  * Guards accessing `/admin/dashboard` are redirected to `/security/dashboard` (**PASS**).
  * Guards accessing `/super-admin/dashboard` receive an explicit 403 card (**PASS**).
  * Admins accessing `/super-admin/dashboard` receive an explicit 403 card (**PASS**).
  * Super Admins can access all consoles (**PASS**).
* **Scenario 6 (Unauthenticated Redirects):** Unauthenticated visits to protected dashboards redirect to the respective login page (**PASS**).
* **Scenario 7 (Session Management):** Logout invalidates server session and clears cookies (**PASS**).
* **Scenario 8 (API `requireRole`):** Calling protected API routes without authorization yields HTTP 401/403 (**PASS**).

### 2.2 Core Logic & Utilities (`tests/unit.mjs`)
* **Visiting Hours:** Verifies open/close boundaries, edge-minute checks, and exclusive upper bounds (6 tests **PASS**).
* **WhatsApp Normalization:** Indian mobile digits to E.164, country code deduplication, and masking (7 tests **PASS**).
* **Slot Grid:** 30-minute intervals, operating hours clamping, past time-slot disabling (5 tests **PASS**).
* **CSV Export Safety:** Neutralizes formula injection (`=`, `-`, `+`, `@`), quotes commas, escapes quotes (6 tests **PASS**).
* **IST Timezone Helpers:** `todayInCampusTz()` and `campusMinutesNow()` operate in UTC+05:30 (3 tests **PASS**).
* **Booking Validation:** Past dates rejected, future bookings accepted (8 tests **PASS**).
* **Supabase Sync Idempotency:** Duplicate sync upserts without crashing, conflict resolution (8 tests **PASS**).
* **Visitor Form Flow:** Name, phone, additional visitors count, and conditional faculty field hiding for "Visitor" category (9 tests **PASS**).

### 2.3 Guard Duty & Shift Handover (`tests/guard-duty-handover.mjs`)
* Validates shift assignments, session starts, duplicate shift prevention, midnight-crossing shifts, equipment checklists, incoming guard acknowledgments, open incident tracking, and gate staffing gap calculations (21 tests **PASS**).

### 2.4 WhatsApp Faculty Approval (`tests/whatsapp-faculty-approval.mjs`)
* Validates cryptographic single-use token generation, SHA-256 storage, single-use consumption, replay attack prevention, and HMAC-SHA256 signature verification on inbound webhooks (18 tests **PASS**).

### 2.5 Gate In/Out Workflow (`tests/gate-in-out-workflow.mjs`)
* Validates zero PII in QR payloads, deterministic SHA-256 token hashing, atomic gate state transitions (`PENDING` -> `APPROVED` -> `CHECKED_IN` -> `CHECKED_OUT`), and duplicate scan blocking (6 tests **PASS**).

---

## 3. Test Execution Commands

To execute tests locally:

```powershell
# 1. Run Core Unit & Validation Tests
node tests/unit.mjs

# 2. Run Role-Based Access Control (RBAC) Tests
node tests/rbac-auth.mjs

# 3. Run Guard Duty & Shift Handover Tests
node tests/guard-duty-handover.mjs

# 4. Run WhatsApp Faculty Approval Tests
node tests/whatsapp-faculty-approval.mjs

# 5. Run Gate In/Out Workflow Tests
node tests/gate-in-out-workflow.mjs

# 6. Run Web TypeScript Compiler Verification
npm run typecheck

# 7. Run Mobile TypeScript Compiler Verification
cd mobile
npx tsc --noEmit
```

---

## 4. Unimplemented & External Dependency Notes

* **Transactional Email Delivery (Resend):** In local development, `RESEND_API_KEY` is not set by default. The server-side OTP generation, hashing, and verification logic is 100% verified and functional, but actual email delivery requires the operator to provide an active Resend API key in `.env.local`.
* **Hardware Camera Scanning:** Simulated in unit tests; full physical camera streaming was verified manually using the mobile viewfinder and web camera stream.
