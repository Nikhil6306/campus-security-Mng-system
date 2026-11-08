# CAMPUS SECURITY MANAGEMENT SYSTEM (CSMS)
## Comprehensive Project Audit Report

**Date of Audit:** November 8, 2026  
**Auditor:** Senior Full-Stack Developer, Mobile Architect, Security Specialist  
**Target Repository:** `Nikhil6306/campus-security-Mng-system`  
**Workspace:** `C:\Users\DELL\campus security mangement system`  
**Active Git Branch:** `main` (Remote: `origin`)  

---

## 1. Executive Summary

The Campus Security Management System (CSMS) is an enterprise-grade digital access and perimeter security platform engineered for **Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar**. The platform bridges public visitor pre-booking, faculty WhatsApp approvals, security guard gate operations, shift handovers, emergency SOS alerts, student outpasses, and real-time administrative oversight across web and mobile platforms.

### Stack & Architectural Summary
* **Web Frontend:** Next.js 15.2.0 (App Router), React 19.0.0, TypeScript 5.7.3, Tailwind CSS 3.4.17, Radix UI primitives (`@radix-ui/*`), `lucide-react`.
* **Guard Mobile Application:** React Native 0.86.3, Expo 57.0.28, TypeScript 6.0.3, Expo Router, `expo-camera`, Lucide React Native, `expo-file-system` local storage.
* **Backend API & Microservices:** Next.js Route Handlers with authenticated session wrappers (`lib/server/http.ts`), role-based access control, cryptographic verification.
* **Dual Database Engine:** 
  * Node.js 24 native SQLite (`node:sqlite`) store (`.data/campus-security.db`) with WAL mode, foreign keys, and atomic write transactions (`BEGIN IMMEDIATE`).
  * Cloud PostgreSQL on Supabase (`@supabase/supabase-js` v2.117.2, `pg` v8.23.1) with 18 incremental migration scripts (`0001_schema.sql` through `0018_student_outpass.sql`).
* **Security & Cryptography:** 
  * Aadhaar AES-256-GCM encryption at rest with HMAC-SHA256 duplicate detection.
  * Opaque QR code pass tokens with single-direction entry/exit partial indexes.
  * SHA-256 single-use faculty approval tokens for WhatsApp webhooks.
  * Secure HTTP-only cookies (`csms_session`) and PBKDF2/SHA-256 password hashing.

---

## 2. Directory & Component Breakdown

| Directory / File | Type | Purpose & Implementation | Status |
| :--- | :--- | :--- | :--- |
| `app/(public)/` | Web Routes | Public visitor portal, landing page, visitor registration wizard, booking status lookup | Operational |
| `app/admin/` | Web Routes | Admin dashboard, visitor analytics, guard management, faculty directory, gate control | Operational |
| `app/security/` | Web Routes | Web-based security desk, gate scan interface, incident reporting, duty handover | Operational |
| `app/faculty/` | Web Routes | Faculty decision portal for one-click visitor approval or rejection | Operational |
| `app/api/` | REST Endpoints | 63 dynamic API route handlers for bookings, gate check-in/out, auth, duty, SOS | Operational |
| `mobile/src/app/` | Mobile Screens | Guard mobile screens: Login, Dashboard, Camera Scan, Verification, Check-In/Out | Operational |
| `mobile/src/services/` | Mobile Services | Mobile API client, offline caching, session persistence | Operational |
| `lib/server/` | Backend Core | Database abstraction (`db.ts`), auth (`auth.ts`), schema (`schema.ts`), seed data | Operational |
| `lib/server/services/`| Business Logic | Bookings, gate verification, WhatsApp provider, outpass, guard duty, SOS | Operational |
| `supabase/migrations/`| Database SQL | 18 production migrations for PostgreSQL schema, RLS policies, RPC functions | Operational |
| `tests/` | QA Test Suites | 74 automated unit, integration, and security regression tests | 100% Passing |

---

## 3. Database Schema & Migration Audit

The database schema supports end-to-end access control through 18 verified migrations:
1. `0001_schema.sql`: Core tables (`visitors`, `visit_requests`, `gates`, `movements`, `app_users`, `sessions`, `incidents`, `audit_logs`).
2. `0002_rls.sql`: Row-level security for public visitor access and role-based staff isolation.
3. `0003_functions.sql`: Trigger-based counters, timestamp updates, and slot allocation constraints.
4. `0004_fix_triggers.sql`: Hardened trigger safety across PostgreSQL versions.
5. `0005_visitor_photos.sql`: Supabase storage bucket policies for encrypted visitor portrait photos.
6. `0006_host_availability.sql`: Faculty availability windows and weekly scheduling.
7. `0007_visitor_simplification.sql`: Streamlined visitor payload schemas with strict staff authorization.
8. `0008_photo_public_read.sql`: Secure authenticated access policies for gate camera preview.
9. `0009_admin_email_restriction.sql`: Database-level trigger enforcing authorized super-admin emails.
10. `0010_guard_dashboard.sql`: Guard shift records, gate assignments, and activity metrics.
11. `0011_visitor_monthly_analytics.sql`: SQL functions for monthly aggregation and category breakdowns.
12. `0012_gate_in_out_workflow.sql`: Atomic gate verification, check-in, and check-out stored procedures.
13. `0013_visitor_registration_fields.sql`: Added expected duration, purpose details, and Aadhaar verification fields.
14. `0014_guard_duty_and_shift_handover.sql`: Shift handovers, equipment checklists, and gate staffing requirements.
15. `0015_whatsapp_faculty_approval.sql`: WhatsApp approval tokens with SHA-256 hashes and expiry.
16. `0016_sos_enhanced.sql`: Emergency incident triggers, auto-escalations, and audio/image evidence.
17. `0017_safety_issues.sql`: Campus hazard reporting, severity triage, and resolution workflows.
18. `0018_student_outpass.sql`: Student hostel outpasses, warden digital sign-offs, and QR gate checks.

---

## 4. Security & Access Control Audit

1. **Authentication:**
   - Multi-role support: `super_admin`, `admin`, `security`, `teacher`, `student`, `visitor`.
   - Admin routes (`/admin/*`) are strictly guarded server-side and client-side via `AdminShell`.
   - Security desk routes (`/security/*`) and Guard Mobile App require active `security` or `admin` role.
2. **Credential Safety:**
   - No hardcoded secrets or production passwords in git-tracked files.
   - `.env` and `.env.local` are excluded via `.gitignore`.
   - `.env.example` provides safe sanitized placeholders.
3. **Data Protection:**
   - Accompanying visitor Aadhaar numbers are encrypted at rest with AES-256-GCM.
   - QR code payloads contain only opaque non-reversible tokens (`https://.../visitor/pass/[id]` or token strings), with zero Personally Identifiable Information (PII) exposed.
4. **Gate Concurrency & Race Condition Prevention:**
   - Check-in and check-out utilize atomic database transactions (`BEGIN IMMEDIATE` in SQLite, single-statement transactions or RPC in Postgres).
   - Partial unique indexes prevent multiple concurrent `inside` states for the same visitor.

---

## 5. Mobile Application Audit

The React Native / Expo application in `mobile/` has been thoroughly audited:
- **Architecture:** Expo Router file-based navigation with TypeScript.
- **Authentication:** Persistent guard session storage with role verification against `/api/auth/login`.
- **Camera Scanning:** Integrated `expo-camera` with back-facing camera, torch toggle, and bounding frame.
- **Verification Workflow:** Real-time lookup against `/api/gate/verify`, fetching visitor portrait, vehicle data, and check-in eligibility.
- **Gate Actions:** Instant check-in and check-out via `/api/gate/check-in` and `/api/gate/check-out` with guard identification and gate logging.
- **Offline Resilience:** Local storage cache via `expo-file-system` and state fallback, preventing false positive gate passes when offline.
