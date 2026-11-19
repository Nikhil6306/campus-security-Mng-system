# Campus Security Management System (CSMS)
## Complete Project Structure & File Directory Guide

**Institution:** Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar  
**Repository:** `https://github.com/Nikhil6306/campus-security-Mng-system.git`  
**Root Directory:** `C:\Users\DELL\campus security mangement system`

---

## 1. High-Level Folder Layout

```
campus-security-management-system/
├── app/                  # Next.js 15 App Router pages, layouts, and API routes
├── backend/              # Standalone NestJS/Prisma service (historical/secondary)
├── components/           # React UI components (UI primitives & domain shells)
├── docs/                 # Official technical documentation & architecture manuals
├── lib/                  # Shared libraries, validation schemas, server repositories
├── mobile/               # Dedicated React Native / Expo guard Android application
├── public/               # Public web assets (logos, icons, static illustrations)
├── scripts/              # Automation, database seeding, and diagnostic scripts
├── supabase/             # Supabase PostgreSQL migrations and SQL schemas
├── tests/                # Automated integration, unit, RBAC, and workflow tests
├── .env.example          # Environment variables template (no secrets)
├── docker-compose.yml    # Docker multi-container composition
├── middleware.ts         # Edge authentication and role routing middleware
├── next.config.mjs       # Next.js configuration
├── package.json          # Root web application dependencies and scripts
└── tsconfig.json         # TypeScript compiler configuration
```

---

## 2. Detailed Directory Breakdown

### 2.1 `app/` — Web Application Routes & APIs
Follows the Next.js 15 App Router convention:
* `(public)/`: Marketing and public information pages (`/about`, `/academics`, `/campus`, `/facilities`, `/pre-book-visit`, `/visitor-guide`, `/booking-status`).
* `admin/`: Administrator console (`/admin/dashboard`, `/admin/bookings`, `/admin/guards`, `/admin/reports`, etc.).
* `super-admin/`: Super Administrator portal (`/super-admin/dashboard`, `/super-admin/login`).
* `security/`: Web gate security console (`/security/dashboard`, `/security/scan`, `/security/check-in`, `/security/check-out`, `/security/handover`).
* `teacher/`: Faculty host dashboard (`/teacher/dashboard`, `/teacher/meetings`, `/teacher/availability`).
* `student/`: Student hostel portal (`/student`).
* `visitor/`: Legacy visitor portal redirects (`/visitor`, `/visitor/book`, `/visitor/pass`).
* `faculty/decision/`: Dedicated token-authenticated page for approving/rejecting visitor meeting requests via email/WhatsApp links.
* `visit/verify/[token]/`: Public QR pass verification endpoint.
* `login/`, `signup/`, `forgot-password/`, `reset-password/`: Authentication screens.
* `api/`: Complete REST API surface (auth, bookings, gate verification, guard shifts, WhatsApp webhooks, SOS emergencies, student outpasses).

### 2.2 `components/` — UI Component Architecture
Organized by domain responsibility:
* `ui/`: Reusable primitive components built with Radix UI and Tailwind CSS (`button`, `card`, `dialog`, `badge`, `input`, `select`, `tabs`, `sonner` toast).
* `admin/`: Admin console components (`admin-shell.tsx`, `visitor-analytics-charts.tsx`, `guard-roster.tsx`).
* `security/`: Guard console components (`security-shell.tsx`, `qr-scanner-card.tsx`, `gate-movement-log.tsx`).
* `visitor/`: Public visitor booking components (`booking-wizard.tsx`, `visitor-pass.tsx`, `booking-status-lookup.tsx`, `visitor-photo-field.tsx`).
* `teacher/`: Faculty portal components (`teacher-meetings-list.tsx`, `availability-grid.tsx`).
* `auth/`: Sign-in, sign-up, and forgot password screens (`login-form.tsx`, `forgot-password-screen.tsx`, `reset-password-screen.tsx`).
* `providers/`: Application context providers (`auth-provider.tsx`, `data-provider.tsx`, `theme-provider.tsx`).
* `shared/`: Cross-cutting components (`navbar.tsx`, `footer.tsx`, `page-header.tsx`, `visitor-photo.tsx`).

### 2.3 `lib/` — Business Logic, Schema & Data Layer
* `lib/api.ts`: Typed client-side HTTP client used by React components to talk to `/api/*`.
* `lib/types.ts`: Comprehensive TypeScript interfaces, entity models, and role definitions.
* `lib/validation.ts`: Client-side validation helpers (phone, vehicle plate, time-slots).
* `lib/demo-accounts.ts`: Demonstration accounts list for UI evaluation.
* `lib/server/`: Server-only business layer (protected with `import "server-only"`):
  * `auth.ts`: Authentication routines (`signIn`, `signUp`, `requireRole`, `currentSession`).
  * `db.ts`: Node.js native SQLite database connection with WAL mode and transactions.
  * `supabase-db.ts`: PostgREST client for dual-writing to Supabase Cloud PostgreSQL.
  * `repo.ts`: Central data repository handling SQL queries for all entities.
  * `schema.ts`: SQLite schema DDL statements and migration runners.
  * `seed.ts`: Comprehensive demonstration dataset seed generator.
  * `password.ts`: Scrypt password hashing and cryptographic random token utilities.
  * `services/`: Domain services:
    * `visitor.ts`: Visitor booking validation, approval processing, and pass issuance.
    * `gate.ts`: Gate scanning, badge assignment, and direction validation.
    * `otp.ts`: 6-digit OTP generation, scrypt hashing, expiry, and rate-limiting.
    * `email.ts`: Transactional email delivery via Resend API.
    * `whatsapp.ts`: WhatsApp Business API messaging and webhook verification.
    * `guard-duty.ts`: Shift tracking, handover processing, and staffing evaluations.

### 2.4 `mobile/` — Android Guard Mobile App
Complete native mobile codebase:
* `src/app/`: Expo Router screens (`login.tsx`, `dashboard.tsx`, `scan.tsx`, `verification.tsx`, `check-in.tsx`, `check-out.tsx`, `emergency.tsx`).
* `src/services/`: Mobile API client (`api.ts`) and device storage (`storage.ts`).
* `android/`: Native Android project with Gradle wrapper (`gradlew.bat`), `build.gradle`, and manifest.
* `app.json`: Expo configuration, permissions (`CAMERA`, `INTERNET`), package name (`com.dsvv.campussecurity`).

### 2.5 `supabase/` — Database Migrations
Chronological SQL migration scripts (`0001_schema.sql` through `0019_password_reset_otps.sql`) configuring PostgreSQL schemas, foreign key constraints, indexes, RLS security policies, and replication triggers.

### 2.6 `tests/` — Automated Test Suites
* `tests/unit.mjs`: Core utility, validation, timezone, slot grid, and CSV safety tests (52 tests).
* `tests/rbac-auth.mjs`: Strict role-based access control, cross-portal login denials, session invalidation, and API route security tests (28 tests).
* `tests/guard-duty-handover.mjs`: Guard shifts, patrol checklists, supervisor approvals, and staffing gap tests (21 tests).
* `tests/whatsapp-faculty-approval.mjs`: WhatsApp normalization, cryptographic single-use approval tokens, and webhook handshake tests (18 tests).
* `tests/gate-in-out-workflow.mjs`: Gate check-in/out atomic state transitions, duplicate scan blocking, and QR token privacy tests (6 tests).
* `tests/prebooking.mjs`: Visitor registration integration tests.
* `tests/visitor-photo.mjs`: Visitor facial photograph upload, format validation, and storage tests.

### 2.7 Root Configuration Files
* `middleware.ts`: Next.js Edge Middleware for role routing and cookie evaluation.
* `docker-compose.yml`: Docker configuration for PostgreSQL, Redis, and backend containers.
* `.env.example`: Safe environment configuration template with dummy placeholders.
* `next.config.mjs`: Next.js bundler configuration.
* `package.json`: NPM package manifest, scripts, and runtime engines.
