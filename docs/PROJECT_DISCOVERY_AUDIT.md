# Campus Security Management System (CSMS)
## Phase 0: Project Discovery and Comprehensive Audit Report

**Target Institution:** Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar, Uttarakhand  
**Audit Date:** 12 November 2026  
**Auditor:** Principal Enterprise Software Architect & QA Automation Specialist  
**Audit Mode:** Strict Non-Destructive Code, Architecture & Live Deployment Inspection  

---

### Executive Summary

The Campus Security Management System (CSMS) is an enterprise-grade security and visitor gate operations platform engineered for Dev Sanskriti Vishwavidyalaya. It unifies a responsive public visitor booking portal, an administrator management console (19 functional modules), a Next.js App Router API backend (65+ route handlers), a Supabase PostgreSQL database layer with 19 migrations, and an Expo/React Native mobile application for gate security officers.

Our comprehensive discovery audit confirms that the core architectural foundations and algorithms (visitor lifecycle, IST slot calculations, cryptographic QR pass generation, Aadhaar AES-256-GCM encryption, WhatsApp webhook handling, and RBAC wrappers) are **sound and production-ready in code**. However, five critical blockers prevent immediate production deployment:
1. **Cloud Database Connectivity on Vercel:** Live Vercel API routes fail with HTTP `500`/`400` because `SUPABASE_DB_URL` is unconfigured in production environment variables.
2. **Missing Android APK Artifact:** No installable Android `.apk` has been compiled; local Gradle builds are blocked by Windows socket virtualization restrictions, requiring EAS Cloud Build.
3. **Mobile Walk-In Gate Check-In Bug:** `mobile/src/app/check-in.tsx` passes a local image URI rather than uploading to `/api/visitor-photo` for a server `photoId`, and sends the current-minute `visitTime` which fails backend validation.
4. **Mobile Dashboard Live Counter Bug:** `mobile/src/services/api.ts` parses `stateJson.data` instead of `stateJson.data?.state`, leaving live visitor, vehicle, and incident metrics at `0`.
5. **Mobile Demo Placeholders:** `forgot-password.tsx` and `notifications.tsx` remain static mock screens rather than connecting to live backend endpoints.

---

### 1. Existing Architecture

```mermaid
graph TD
    subgraph Clients ["Client Platforms"]
        PublicWeb["Public Web Portal\n(/pre-book-visit, /booking-status)"]
        AdminWeb["Admin Management Console\n(/admin/* - 19 Modules)"]
        StaffWeb["Faculty & Security Portals\n(/faculty, /security, /teacher)"]
        MobileApp["Security Guard Mobile App\n(React Native / Expo SDK 57)"]
    end

    subgraph Gateway ["Application Gateway & API (Next.js 15)"]
        HTTPMiddleware["Auth & RBAC Middleware\n(lib/server/http.ts)"]
        APIEndpoints["65+ App Router Endpoints\n(app/api/**)"]
    end

    subgraph LogicLayer ["Domain Service Layer (lib/server/services/)"]
        BookingsSvc["Bookings & Slots Engine"]
        GateSvc["Gate Verification & Check-In/Out"]
        DutySvc["Guard Duty, Shifts & Patrols"]
        AuthSvc["Auth & Session Management"]
        NotifSvc["Notifications & Meta WhatsApp"]
        AadhaarSvc["Aadhaar AES-256 Encryption"]
    end

    subgraph DataStorage ["Persistence & Realtime"]
        SupabasePG[("Supabase Cloud PostgreSQL\n19 Migrations + RLS Policies")]
        LocalSQLite[("SQLite WAL Fallback\n(.data/campus-security.db)")]
        SupabaseStorage["Supabase Storage Bucket\n(campus-security / visitor-photos)"]
    end

    PublicWeb --> HTTPMiddleware
    AdminWeb --> HTTPMiddleware
    StaffWeb --> HTTPMiddleware
    MobileApp --> HTTPMiddleware
    HTTPMiddleware --> APIEndpoints
    APIEndpoints --> LogicLayer
    LogicLayer --> SupabasePG
    LogicLayer --> LocalSQLite
    LogicLayer --> SupabaseStorage
```

- **Frontend Core:** Next.js 15.2.0, React 19, TypeScript 5.7, Tailwind CSS, Radix UI primitives.
- **Mobile Core:** React Native 0.86.3, Expo SDK 57.0.28, Expo Router 57.0.25, Expo Camera 57.0.6, Android package `com.dsvv.campussecurity`.
- **Backend Architecture:** Serverless-compatible Next.js App Router handlers in `app/api/**` running in Node.js runtime (`export const runtime = "nodejs"`).
- **Database Architecture:** Dual-engine adapter in `lib/server/db.ts` automatically selecting PostgreSQL when deployed on Vercel or when `DATABASE_DRIVER=postgres` is set, with local SQLite fallback.
- **Identity & Security:** Supabase Auth + `public.profiles` role table (`admin`, `super_admin`, `security`, `teacher`, `student`, `visitor`) with httpOnly `csms_session` cookie and Bearer authorization tokens.

---

### 2. Existing Working Features

1. **Public Visitor Pre-Booking:** 4-section responsive wizard (`BookingWizard`) with real-time field validation, IST-aware date/time slot checking, vehicle declaration, and mandatory visitor photograph capture.
2. **Cryptographic QR Code Generation:** Pass generation in `PassQR` (`qrcode.react`) carrying opaque SHA-256 pass tokens with zero embedded personal data (PII). Printable PNG and PDF pass export.
3. **Visitor Booking Status Lookup:** `/booking-status` allows public visitors to query their pass status securely by requiring both the booking reference and matching phone number.
4. **Admin Dashboard (19 Modules):** Full management console covering visitors, gate activity, vehicles, guards, shift assignments, incidents, emergency SOS alerts, departments, faculty, and system configuration.
5. **WhatsApp Faculty Meeting Approvals:** Meta WhatsApp Cloud API integration with signed HMAC-SHA256 webhooks, single-use 24-hour cryptographic approval tokens, and automatic pass issuance upon acceptance.
6. **Aadhaar Protection at Rest:** Hardware-grade AES-256-GCM authenticated encryption with random 12-byte IVs and duplicate-detection keyed HMAC digests.
7. **Gate In/Out Workflow Engine:** Server-side verification enforcing status checks (rejects expired, pending, or cancelled visits), preventing duplicate check-ins, and recording exit timestamps.
8. **Role-Based Security Shells:** `AdminShell` and `SecurityShell` client-side route guards backed by server-side `authedRoute` and `mutationRoute` role enforcement.
9. **Automated Test Suites:** 89 automated tests passing across `unit.mjs` (50 passed), `whatsapp-faculty-approval.mjs` (18 passed), `prebooking.mjs` (15 passed), and `gate-in-out-workflow.mjs` (6 passed).

---

### 3. Incomplete Features

1. **Mobile Guard Forgot Password (`mobile/src/app/forgot-password.tsx`):** Displays a mock notification stating *"Nothing is emailed in this frontend-only demo."* It must be wired to `POST /api/auth/forgot-password`.
2. **Mobile Notifications Inbox (`mobile/src/app/notifications.tsx`):** Renders static mock data (`initialItems`) with a visible `"DEMO"` pill rather than querying live server notifications from `/api/state` or Supabase Realtime.
3. **Mobile Shift Toggle Data Flow (`mobile/src/app/dashboard.tsx`):** Clock-in and clock-out pass placeholder IDs (`session?.refId` and `'current'`) instead of dynamically tracking active shift session IDs returned by `POST /api/guard-duty/shift/start`.
4. **Push Notifications Subsystem:** Expo device push notification registration (`expo-notifications`) is not integrated into `mobile/src/services/api.ts` or the database schema (`device_tokens` table is missing).
5. **Supervisor Handover Workflow on Mobile:** Shift handover creation and incoming guard acknowledgement screens exist on the web (`/security/handover`), but are simplified or absent on the mobile application.

---

### 4. Broken Functionality

1. **Live Vercel Backend Database Connection:** Live endpoints `https://campus-security-management.vercel.app/api/auth/session` and `/api/state` return HTTP `500` (`internal_error`), and `/api/auth/login` returns HTTP `400` (`"unable to open database file"`). This occurs because `lib/server/db.ts` auto-detects `process.env.VERCEL` and switches to PostgreSQL, but `SUPABASE_DB_URL` is undefined on Vercel.
2. **Mobile Walk-in Check-In (`mobile/src/app/check-in.tsx`):**
   - Submits raw local image URI in `createWalkInBooking({ photoUrl })` instead of uploading to `/api/visitor-photo` to receive a validated `photoId`, causing backend rejection at `bookings.ts:219`.
   - Generates `visitTime: new Date().toTimeString().slice(0, 5)`, which immediately fails the backend validation rule `bookings.ts:205` (`minutes <= nowMins` triggers `past_time` rejection).
3. **Mobile Dashboard Live Counters (`mobile/src/services/api.ts:358`):** `getGuardDashboardData()` inspects `stateJson.data` instead of `stateJson.data?.state`, leaving `visitorsToday`, `visitorsInside`, and `vehiclesInside` permanently at `0`.
4. **Guard Duty Test Suite (`tests/guard-duty-handover.mjs`):** Fails 14 of 21 test scenarios because it queries an unmigrated test database file (`campus_security.db` at root) rather than the active database file (`.data/campus-security.db`).

---

### 5. Database Issues

1. **Unconfigured Production Environment Variables:** The production Supabase database (`https://qpamgfhggxwctoibmsbl.supabase.co`) connection string is absent from Vercel environment variables and `.env.local`.
2. **Schema Divergence in Tests:** Migration `0014_guard_duty_and_shift_handover.sql` added 8 shift management tables in Supabase, but `campus_security.db` used by offline scripts lacks these tables.
3. **Connection Pooler Latency:** Supabase requires port `6543` (transaction mode pooler via Supavisor) for serverless environments (Vercel) to prevent connection exhaustion. Direct connection port `5432` will exhaust connections during high traffic.
4. **Missing Device Tokens Table:** Push notification device token registration requires a dedicated table in Supabase with user ID references and device platform metadata.

---

### 6. API Issues

1. **Error Response Masking:** Unhandled exceptions in Next.js route handlers default to a generic `"Something went wrong on our side. Please try again."` without structured error subcodes in production, making client-side mobile debugging difficult.
2. **Missing Rate Limiting:** Public endpoints (`/api/bookings`, `/api/auth/login`, `/api/sos`) lack token-bucket rate limiting on Vercel, leaving the system open to automated spam submissions.
3. **Multipart Form Upload Disconnect on Mobile:** While the web client uses `FormData` for photo uploads to `/api/visitor-photo`, the mobile service helper does not provide a multipart streaming upload utility.

---

### 7. Security Issues

1. **Hardcoded Login Credentials in Mobile App:** `mobile/src/app/login.tsx` initializes state with `security@dsvv.edu.in` and `Security@123`.
2. **Visible Test Shortcuts in Scanner:** `mobile/src/app/scan.tsx` displays quick test buttons (`DEMO-*` codes) directly in the camera view UI.
3. **Lack of Biometric Gate Guard Auth:** Mobile login relies solely on password entry without optional biometric (fingerprint/face) unlock, which is standard for security guard devices.
4. **Admin Role Isolation Trigger Dependency:** Admin privilege is locked to `nikhilshukla1200@gmail.com` via Supabase trigger `0009_admin_email_restriction.sql`. If this trigger is bypassed or unapplied, role escalations could occur.

---

### 8. Mobile Application Issues

1. **No Production APK Artifact:** Local Gradle builds on Windows fail with `java.net.SocketException: Permission denied: getsockopt` due to containerized socket isolation. An installable APK can only be compiled via EAS Cloud Build.
2. **No Physical Device Verification:** None of the hardware capabilities (camera QR autofocus, offline queue persistence, hardware vibration, real GPS coordinates for SOS) have been verified on an actual physical Android smartphone.
3. **Lack of Offline Mutation Queue:** If a guard loses WiFi/cellular connectivity at an outer campus gate, scans and walk-in records cannot be queued locally for automatic replay upon reconnection.

---

### 9. Deployment Issues

1. **Vercel / Supabase Mismatch:** Vercel deployment builds successfully as static/serverless HTML, but database runtime operations fail immediately due to unconfigured connection strings.
2. **Dual Codebase Confusion:** The presence of an unused `backend/` folder (NestJS + Prisma + PostgreSQL) confuses repository auditing. All active backend logic resides exclusively in Next.js `app/api/**`.
3. **EAS CLI Authentication:** EAS Build requires an active Expo user account login (`eas login`) and project initialization (`eas init`) executed from an unconstrained terminal.

---

### 10. Technical Debt

1. **Unused Standalone NestJS Backend (`backend/`):** Contains 480,000+ bytes of orphaned NestJS, Prisma, and Docker Compose configurations that are not connected to the active web or mobile applications.
2. **Dual Database Driver Maintenance:** Maintaining parity between SQLite SQL strings and PostgreSQL Supabase migrations requires ongoing synchronization overhead.
3. **Duplicate Types:** TypeScript interfaces for visitors and bookings exist in `lib/types.ts`, `lib/api.ts`, and `mobile/src/services/api.ts` with minor casing and optionality variations.

---

### 11. Dependencies Between Modules

```
[Public Website / Pre-Booking] ──> [Next.js /api/bookings] ──> [Supabase visit_requests]
                                                                        │
[Meta WhatsApp Webhook] ─────────> [Next.js /api/faculty]  ─────────────┤
                                                                        ▼
[Admin Dashboard Console] <──────> [/api/state Sync] <───────> [Status: APPROVED]
                                                                        │
[Mobile Guard App] ──────────────> [/api/gate/verify] <─────────────────┘
        │
        └──> [/api/gate/check-in] ──> [Supabase movements / check_logs]
```

- Visitor gate verification strictly depends on prior faculty/admin approval.
- Mobile live statistics strictly depend on the `/api/state` or `/api/guard-duty/dashboard` payload format.
- Walk-in mobile registration strictly depends on prior photo storage upload to `/api/visitor-photo`.

---

### 12. Risk Assessment Matrix

| Risk Factor | Severity | Probability | Mitigation Strategy |
|---|---|---|---|
| **Vercel DB Connection Failure** | **Critical** | **High** | Supply `SUPABASE_DB_URL` (pooler mode) in Vercel settings and redeploy. |
| **Mobile Check-in Crash at Gate** | **Critical** | **High** | Fix `check-in.tsx` photo upload pipeline and IST time slot calculation. |
| **EAS Build Failure / Quota** | **High** | **Medium** | Use standard free tier Expo EAS profile with `buildType: apk`. |
| **Outer Gate Connectivity Loss** | **Medium** | **High** | Implement local SQLite/AsyncStorage draft queue in mobile app. |
| **WhatsApp Rate Limits** | **Low** | **Low** | Batch outbound notifications and maintain delivery receipt logging. |

---

### Conclusion & Approval Gate

The project code is structurally mature and well-architected. With targeted fixes to the 3 mobile integration bugs, configuration of the production Supabase database URL on Vercel, and execution of the EAS Android APK build, the system will achieve 100% production readiness well before the 24 November 2026 presentation deadline.

