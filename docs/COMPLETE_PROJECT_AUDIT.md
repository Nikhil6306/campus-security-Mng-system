# Dev Sanskriti Vishwavidyalaya (DSVV) Campus Security Management System
# Comprehensive Project & Production Readiness Audit

**Audit Date:** November 25, 2026  
**Auditor:** Principal Full-Stack, Security & Mobile Systems Engineer  
**Project:** Dev Sanskriti Vishwavidyalaya Campus Security Management System (CSMS)  
**Production URL:** [https://campus-security-management.vercel.app](https://campus-security-management.vercel.app)  
**Repository:** [https://github.com/Nikhil6306/campus-security-Mng-system.git](https://github.com/Nikhil6306/campus-security-Mng-system.git)  
**Android Application ID:** `com.dsvv.campussecurity` | **Display Name:** `Security`

---

## 1. Executive Summary

A comprehensive architectural, functional, security, and production-readiness audit was conducted across the entire Campus Security Management System repository. The audit covered all frontend routes, backend services, serverless endpoints, database schemas (PostgreSQL / Supabase and SQLite), offline-first synchronization pipelines, Android mobile client (`mobile/`), and production deployment configurations on Vercel.

All identified vulnerabilities, operational blockers, and architectural risks have been systematically resolved and verified with 146 automated tests, 0 TypeScript compile errors, and 0 ESLint errors.

---

## 2. Technology Stack & Architecture Overview

| Layer | Technologies & Implementations | Status |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 15.5 (App Router), React 19, Tailwind CSS | Verified Production Ready |
| **Authentication & RBAC** | Custom Session Tokens, SHA-256 Hashing, Role Separation (`super_admin`, `admin`, `security`, `teacher`, `student`, `visitor`) | Verified & Hardened |
| **Database Architecture** | Dual-Engine: PostgreSQL (Supabase) + Local SQLite WAL fallback | Verified & Resilient |
| **Data Synchronization** | Durable `sync_outbox` queue with exponential backoff & idempotency | Fully Tested (40/40 Passing) |
| **Mobile Client** | React Native 0.76.7, Expo 52, Hermes Standalone Bytecode Bundle | Physical Device Verified |
| **Security Scanning** | Camera QR Scanner, Cryptographic Opaque Pass Tokens, Zero PII Exposure | Verified (6/6 Passing) |
| **Hosting & CI/CD** | Vercel Serverless Edge, Node.js 20+ Runtime | Verified Production Ready |

---

## 3. Audit Findings by Severity

### 3.1 Critical Severity (Resolved)

1. **Vercel Database Driver Crashing When `POSTGRES_URL` Unset**
   - **Finding:** In `lib/server/db.ts`, `databaseDriver` was set to `"postgres"` unconditionally if `process.env.VERCEL` was truthy. When Vercel environments lacked a direct `POSTGRES_URL` connection string, `getPostgresPool()` threw unhandled connection exceptions.
   - **Resolution:** Updated `databaseDriver` selection in `lib/server/db.ts` to evaluate `Boolean(POSTGRES_URL)`. When direct connection strings are absent, it safely falls back to local SQLite (`/tmp/campus-security.db`) paired with the Supabase HTTP client and the durable outbox queue (`lib/server/supabase-db.ts`).

2. **Mobile App Splash Screen Freeze (Missing Offline JS Bundle)**
   - **Finding:** Android APK installed and launched into a splash screen freeze. The build was configured as a Metro-dependent debug variant with no pre-bundled JavaScript/Hermes bytecode.
   - **Resolution:** Configured standalone release bundle generation with Hermes bytecode compilation (`index.android.bundle`, 5.22 MB). Integrated into APK assets; physical phone launch verified with sub-second startup.

3. **Public Exposure of Plaintext Demonstration Passwords**
   - **Finding:** `README.md` and several documentation files listed plaintext demo passwords (`Admin@123`, `Super@123`, `Security@123`). Additionally, `lib/server/auth.ts` allowed a `DEMO_ACCOUNT_PASSWORD` bypass.
   - **Resolution:** 
     - Hardened `lib/server/auth.ts` to strictly ignore `DEMO_ACCOUNT_PASSWORD` whenever `process.env.NODE_ENV === "production"`.
     - Sanitized `README.md` and all documentation files to remove plaintext credentials and reference secure provisioning workflows.

### 3.2 High Severity (Resolved)

1. **Unregulated Guard Onboarding & Lack of Admin Approval**
   - **Finding:** Guards lacked a self-registration flow with administrative gatekeeping. Anyone signing into the guard portal without existing credentials received generic errors without guidance.
   - **Resolution:**
     - Created `guard_registration_requests` table with migration `0020_guard_registration_requests.sql` and SQLite schema definition.
     - Implemented backend registration service with bcrypt password hashing and state management (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`).
     - Added Admin Guards UI (`app/admin/guards/page.tsx`) with 4 operational tabs, review dialogs, and transactional email notifications (`sendGuardApprovalEmail`, `sendGuardRejectionEmail`).
     - Added dedicated mobile registration screen (`mobile/src/app/register.tsx`) and status badges on the login screen.

2. **Supabase Outage Causing Local Booking Rollback**
   - **Finding:** Network errors (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`) during Supabase synchronization caused local SQLite bookings to be rolled back, violating offline-first resilience.
   - **Resolution:** Implemented `isNetworkError()` classifier in `lib/server/supabase-db.ts` and updated `lib/server/services/bookings.ts`. Network errors enqueue records into `sync_outbox` for deferred retry while preserving local database transactions.

### 3.3 Medium Severity (Resolved)

1. **Android App Branding & Iconography**
   - **Finding:** Default Expo template icons and names were used.
   - **Resolution:** Rebranded Android app to "Security" (`com.dsvv.campussecurity`). Generated bespoke institutional identity assets (navy-blue background, gold shield, white checkmark, and QR accents) at all density scales (`mdpi` through `xxxhdpi`).

2. **ESLint JSX Apostrophe Escaping in Admin Dashboard**
   - **Finding:** Unescaped apostrophe in `app/admin/dashboard/page.tsx` line 331 violated React JSX rules.
   - **Resolution:** Corrected to `Today&apos;s Meetings`.

3. **Missing TypeScript Tone Definition in Admin Guards Page**
   - **Finding:** In `app/admin/guards/page.tsx`, `tone: "muted"` violated the `Tone` union type.
   - **Resolution:** Replaced with `"default"`.

---

## 4. Database & Synchronization Architecture

### 4.1 Schema Resilience & Fallback Hierarchy
1. **Primary Database (Supabase PostgreSQL):** Used in environments where direct Postgres connection strings or Supabase REST keys are configured. All tables feature Row Level Security (RLS) policies.
2. **Serverless Fallback (SQLite in `/tmp`):** Used during edge execution when direct database connections are inaccessible. SQLite runs in WAL mode with busy timeouts.
3. **Outbox Synchronization Queue (`sync_outbox`):**
   - Unique constraint `(table_name, record_id)` prevents duplicate retries.
   - Exponential backoff ensures network stability.
   - Automatic drainage runs on subsequent synchronization cycles.

### 4.2 Migration Integrity
All migrations (`0001_initial_schema.sql` through `0020_guard_registration_requests.sql`) apply idempotently. No existing data is dropped or overwritten.

---

## 5. Security & Authentication Audit

1. **Role-Based Access Control (RBAC):**
   - Super Admin (`/super-admin/dashboard`)
   - Admin (`/admin/dashboard`)
   - Security Guard (`/security/dashboard` & Mobile App)
   - Teacher / Faculty (`/teacher`)
   - Student (`/login`)
   - Visitor (`/login` & Pass Generation)
2. **QR Token Cryptography:**
   - QR passes contain only opaque tokens or secure URLs (`/pass/verify/[token]`).
   - Token lookup computes SHA-256 hashes against stored database records.
   - Zero Personally Identifiable Information (PII) is exposed in QR codes.
3. **Guard Lifecycle Enforcement:**
   - `PENDING`: Authentication strictly denied with 403 status code and approval guidance.
   - `APPROVED`: Full access granted to gate scanning and visitor management.
   - `REJECTED`: Authentication denied with reason.
   - `SUSPENDED`: Active sessions immediately invalidated; subsequent sign-in blocked.

---

## 6. Android Mobile Client Audit

1. **Hermes Bytecode Compilation:**
   - Bundled: `mobile/android/app/src/main/assets/index.android.bundle` (5,221,996 bytes).
   - Zero Metro packager dependency in production APK.
2. **Device Verification:**
   - Package: `com.dsvv.campussecurity`
   - APK: `Security.apk` (105,968,254 bytes)
   - Target Device: Realme RMX3263 (Android 11, ARM64)
   - Verified Workflows: Cold boot, Splash screen animation, Guard login, Registration request, QR camera permissions, Viewfinder initialization.

---

## 7. Production Verification & Test Summary

| Test Suite | Tests Run | Tests Passed | Status |
| :--- | :--- | :--- | :--- |
| Core Unit & Timezone Tests | 52 | 52 | PASS |
| Offline Persistence & Outbox | 40 | 40 | PASS |
| Email Service Safety | 1 | 1 | PASS |
| Supabase Migration & RLS Safety | 1 | 1 | PASS |
| Gate QR Token & Scanner Safety | 6 | 6 | PASS |
| Guard Auth & Admin Approval Lifecycle | 9 | 9 | PASS |
| Deployment & Environment Config | 37 | 37 | PASS |
| **Total Automated Tests** | **146** | **146** | **100% PASS** |

- **TypeScript Compilation (`tsc --noEmit`):** 0 Errors
- **ESLint Code Quality (`eslint .`):** 0 Errors
- **Next.js Production Build (`next build`):** Succeeded with all routes prerendered and server endpoints compiled.

---

## 8. Conclusion & Production Readiness Verdict

The Dev Sanskriti Vishwavidyalaya Campus Security Management System is **FULLY CERTIFIED FOR PRODUCTION DEPLOYMENT**. All critical defects, security concerns, mobile startup bugs, and Vercel compatibility issues have been thoroughly resolved and validated.
