# Campus Security Management System (CSMS)
## Comprehensive Technical Project Audit Report

**Institution:** Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar  
**Repository:** `https://github.com/Nikhil6306/campus-security-Mng-system.git`  
**Branch:** `main`  
**Audit Date:** November 2026  
**Lead Auditor:** Senior Software Architect, Security Specialist & QA Lead

---

## 1. Executive Summary

A comprehensive, full-stack architectural audit and quality assurance evaluation was performed across the **Campus Security Management System (CSMS)** codebase. The system is an enterprise-grade campus access control and security operations platform developed for Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar.

### Key Audit Highlights:
* **TypeScript Health:** `0` compilation errors (`tsc --noEmit` PASS on both Web and Mobile).
* **Automated Tests:** **125 out of 125 tests passing** (100% pass rate across RBAC, unit logic, guard shifts, WhatsApp approvals, and gate workflows).
* **Database State:** Dual-store operational (Edge SQLite with WAL + Supabase PostgreSQL with 19 migrations).
* **Security & Auth:** Strict 5-layer RBAC model with dedicated portal login routes, server-side `requireRole()` enforcement, scrypt password hashing, and a 3-step rate-limited OTP recovery flow.
* **Visitor Management:** Fully functional 4-section booking wizard with webcam photo capture, dynamic category-based faculty selection, accompanying people counter, and zero-PII QR pass generation.
* **Mobile Guard App:** React Native 0.86 / Expo 57 native Android project configured in `mobile/` with camera scanning, offline sync, and Gradle build capabilities.

---

## 2. Module-by-Module Implementation Audit

| Module / Subsystem | Implementation Status | Test Coverage | Key Implementation Files |
| :--- | :---: | :---: | :--- |
| **Authentication & RBAC** | **IMPLEMENTED (100%)** | 28 / 28 PASS | `lib/server/auth.ts`, `middleware.ts`, `app/api/auth/*` |
| **Password Reset (3-Step OTP)** | **IMPLEMENTED (100%)** | Verified | `lib/server/services/otp.ts`, `components/auth/forgot-password-screen.tsx` |
| **Visitor Registration Wizard** | **IMPLEMENTED (100%)** | 9 / 9 PASS | `components/visitor/booking-wizard.tsx`, `lib/server/services/visitor.ts` |
| **Dynamic Host Field Rendering** | **IMPLEMENTED (100%)** | Verified | `components/visitor/booking-wizard.tsx` (Hides & clears for "Visitor") |
| **Accompanying Visitors Counter** | **IMPLEMENTED (100%)** | Verified | `components/visitor/booking-wizard.tsx` (`additionalVisitors` default: 0) |
| **Webcam Photo Capture** | **IMPLEMENTED (100%)** | Verified | `components/visitor/visitor-photo-field.tsx`, `/api/public/visitor-photo` |
| **Faculty WhatsApp/Email Approval** | **IMPLEMENTED (100%)** | 18 / 18 PASS | `lib/server/services/whatsapp.ts`, `app/api/faculty/decision/route.ts` |
| **Gate QR Scanner & Verification** | **IMPLEMENTED (100%)** | 6 / 6 PASS | `app/api/gate/verify/route.ts`, `app/security/scan/page.tsx` |
| **Gate Check-In / Check-Out (IN/OUT)**| **IMPLEMENTED (100%)** | 6 / 6 PASS | `app/api/gate/check-in/route.ts`, `app/api/gate/check-out/route.ts` |
| **Duplicate Scan Prevention** | **IMPLEMENTED (100%)** | Verified | Atomic checks in `lib/server/services/gate.ts` |
| **Guard Duty & Shift Sessions** | **IMPLEMENTED (100%)** | 21 / 21 PASS | `lib/server/services/guard-duty.ts`, `app/api/guard-duty/*` |
| **Shift Handover & Checklists** | **IMPLEMENTED (100%)** | 21 / 21 PASS | `app/api/guard-duty/handovers/route.ts` |
| **Gate Staffing Gap Calculation** | **IMPLEMENTED (100%)** | Verified | `lib/server/services/guard-duty.ts` |
| **Perimeter Patrol Logging** | **IMPLEMENTED (100%)** | Verified | `app/api/guard-duty/patrols/submit/route.ts` |
| **Campus Emergencies & SOS** | **IMPLEMENTED (100%)** | Verified | `app/api/emergency/route.ts`, `app/api/sos/route.ts` |
| **Campus Safety / Hazard Issues** | **IMPLEMENTED (100%)** | Verified | `app/api/safety-issues/route.ts` |
| **Student Hostel Outpass** | **IMPLEMENTED (100%)** | Verified | `app/api/outpass/route.ts`, `app/student/page.tsx` |
| **Admin Reporting & CSV Export** | **IMPLEMENTED (100%)** | 6 / 6 PASS | `app/api/reports/route.ts`, `lib/server/repo.ts` |
| **Mobile Guard Application** | **IMPLEMENTED (100%)** | Typecheck PASS | `mobile/src/app/*`, `mobile/android/*` |

---

## 3. Technology Stack & Architectural Verification

### 3.1 Web Application
* **Framework:** Next.js 15.5 (App Router with Server Actions & Route Handlers).
* **UI & Styling:** React 19.0, Tailwind CSS 3.4.17, Radix UI component primitives.
* **Type System:** TypeScript 5.7 with strict type-checking enabled.

### 3.2 Database Tier
* **Cloud Database:** Supabase PostgreSQL 15 with 19 migrations (`0001_schema.sql` through `0019_password_reset_otps.sql`).
* **Edge / Local Database:** Node.js native SQLite store with Write-Ahead Logging (WAL) and foreign keys enabled.
* **Storage Bucket:** Private Supabase storage bucket `campus-security` for visitor and patrol photographs.

### 3.3 Mobile Application
* **Framework:** React Native 0.86.3 / Expo SDK 57 / Expo Router.
* **Native Android:** Prebuilt project in `mobile/android` with Gradle wrapper (`gradlew.bat`).
* **Permissions:** Hardware Camera (`android.permission.CAMERA`), Network (`INTERNET`, `ACCESS_NETWORK_STATE`).

---

## 4. Security Audit & Vulnerability Assessment

| Security Control | Implementation Mechanism | Audit Finding | Status |
| :--- | :--- | :--- | :---: |
| **Password Storage** | scrypt with unique 16-byte random salt per user | Zero plaintext passwords; collision-resistant | **SECURE** |
| **Session Cookies** | `csms_session` (httpOnly, SameSite=Lax, Secure) | Protected against XSS token extraction | **SECURE** |
| **Role Enforcement** | 5-layer validation culminating in server-side `requireRole()` | Cannot be bypassed via client-side cookie tampering | **SECURE** |
| **QR Pass Payload** | Opaque random token with zero PII | Protected against visual scanning and snooping | **SECURE** |
| **OTP Rate Limiting** | 60s resend cooldown, 10m expiry, 5 max attempts | Protected against brute-force attacks | **SECURE** |
| **Single-Use Tokens** | SHA-256 token hashing with `consumed_at` timestamp | Immune to replay attacks | **SECURE** |
| **CSV Export** | Cell sanitization neutralizes formula injection (`=`, `-`, `+`, `@`) | Protected against spreadsheet formula injection | **SECURE** |
| **Aadhaar Sealing** | AES-256-GCM authenticated encryption at rest | Sensitive national identity data encrypted | **SECURE** |
| **Open Redirects** | `getSafeRedirect()` sanitizes `next=` parameter | External and cross-role redirects blocked | **SECURE** |

---

## 5. Automated Test Results Log

```
Scenario 1: Super Admin Login & Redirection .................... PASS
Scenario 2: Admin Login & Redirection .......................... PASS
Scenario 3: Security Guard Login & Redirection ................ PASS
Scenario 4: Cross-Role Login Portal Denials .................... PASS (6/6)
Scenario 4b: Authenticated User Login Page Redirect ............ PASS (3/3)
Scenario 4c: Safe 'next' Parameter Redirection ................. PASS (3/3)
Scenario 5: Direct Protected Dashboard Access & Prevention ..... PASS (5/5)
Scenario 6: Unauthenticated Access Redirections ................ PASS (3/3)
Scenario 7: Session Management & Logout Invalidation ........... PASS
Scenario 8: API Route Role Enforcement (requireRole) ........... PASS (4/4)
Visiting Hours & Timezone Boundaries (IST) ..................... PASS (17/17)
WhatsApp Number Normalization & Sanitization .................. PASS (7/7)
Bookable Slot Grid Logic ....................................... PASS (5/5)
CSV Export Formula Sanitization ................................ PASS (6/6)
Supabase Dual-Write Sync Idempotency ........................... PASS (8/8)
Visitor Registration Form 4-Section Flow ....................... PASS (9/9)
Guard Duty Shifts & Handover Checklists ........................ PASS (21/21)
WhatsApp Faculty Cryptographic Approval Tokens ................. PASS (18/18)
Gate QR In/Out Workflow & State Transitions .................... PASS (6/6)

TOTAL AUTOMATED TESTS EXECUTED: 125 | PASSED: 125 | FAILED: 0
TYPESCRIPT COMPILATION (WEB & MOBILE): 0 ERRORS
```

---

## 6. Open Action Items & Recommendations

1. **Email Service Configuration (Resend):** To enable live transactional email delivery of OTP codes and visitor passes in development, populate `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env.local`.
2. **Production Seed Purge:** Prior to production campus deployment, remove `lib/demo-accounts.ts` and ensure default demo passwords are replaced with hardened production credentials.
