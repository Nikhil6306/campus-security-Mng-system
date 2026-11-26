# Deep Technical Audit Report: EmailJS + Supabase System
## DSVV Campus Security Management System (CSMS)
**Audit Date:** 26 November 2026
**Auditor:** Senior Full-Stack Security & QA Architect
**Scope:** EmailJS delivery, Cryptographic OTP, Multi-role Password Recovery, Two-Step Email Change, Mobile App Services, Supabase RLS & PostgreSQL Schemas.

---

## 1. Executive Summary

A comprehensive, end-to-end technical audit was conducted across the codebase of the DSVV Campus Security Management System. The audit verified:
1. The server-side EmailJS REST client architecture.
2. Cryptographic security of OTP generation, scrypt storage, and constant-time verification.
3. Password recovery workflows across all system roles (`super_admin`, `admin`, `security`, `teacher`, `student`, `visitor`).
4. Two-step email change security model with old-email OTP verification followed by new-email OTP confirmation.
5. Android/React Native mobile application API integration.
6. Supabase Row Level Security (RLS) policies and SQLite offline-first fallback synchronization.

---

## 2. Inventory of Inspected Files

| Category | File Path | Status |
| :--- | :--- | :--- |
| **Email Service** | `lib/email/email-service.ts` | Audited & Validated |
| **Email Config** | `lib/email/email-config.ts` | Audited & Validated |
| **Email Templates** | `lib/email/email-templates.ts` | Audited & Validated |
| **OTP Service** | `lib/server/services/otp.ts` | Audited & Validated |
| **Email Change Service** | `lib/server/services/email-change.ts` | Audited & Repaired |
| **Security Audit** | `lib/server/services/security-audit.ts` | Audited & Validated |
| **Core Auth** | `lib/server/auth.ts` | Audited & Validated |
| **Password Utilities** | `lib/server/password.ts` | Audited & Validated |
| **Database Schema (SQLite)** | `lib/server/schema.ts` | Audited & Validated |
| **Database Migration (Supabase)** | `supabase/migrations/0021_emailjs_otp_and_notifications.sql` | Audited & Repaired |
| **Reset Password API** | `app/api/auth/reset-password/route.ts` | Audited & Repaired |
| **Send OTP API** | `app/api/auth/send-otp/route.ts` | Audited & Validated |
| **Verify OTP API** | `app/api/auth/verify-otp/route.ts` | Audited & Validated |
| **Change Email (Step 1)** | `app/api/auth/change-email/request/route.ts` | Audited & Validated |
| **Change Email (Step 2)** | `app/api/auth/change-email/verify-old/route.ts` | Audited & Validated |
| **Change Email (Step 3)** | `app/api/auth/change-email/verify-new/route.ts` | Audited & Validated |
| **Mobile Services** | `mobile/src/services/api.ts` | Audited & Repaired |
| **Mobile Forgot Password** | `mobile/app/forgot-password.tsx` & `mobile/src/app/forgot-password.tsx` | Audited & Validated |
| **Mobile Profile Settings** | `mobile/app/profile.tsx` & `mobile/src/app/profile.tsx` | Audited & Validated |
| **Web UI Components** | `components/auth/forgot-password-screen.tsx`, `components/auth/change-email-dialog.tsx` | Audited & Validated |

**Total Files Inspected:** 23 critical architecture files.

---

## 3. Discovered Vulnerabilities & Integration Bugs

### Bug #1: Direct API Password Reset Bypass Opportunity (Critical)
- **Location:** `app/api/auth/reset-password/route.ts`
- **Issue:** When a user submitted an `email` in the body along with a session token or cookie from another session, the code would proceed to reset the password without requiring `otp` for that email.
- **Remediation:** Added strict check: if `input.email` is supplied without `input.otp`, immediately throw a 400 Bad Request: `"Verification code (OTP) is required to reset password for this email."` If both are present, prioritize verifying the OTP.

### Bug #2: Supabase UUID vs String ID Type Mismatch (Critical)
- **Location:** `supabase/migrations/0021_emailjs_otp_and_notifications.sql`
- **Issue:** `auth_email_otps`, `pending_email_changes`, `account_security_logs`, and `email_notifications` declared `id UUID PRIMARY KEY`. However, application services generate human-readable string IDs (`otp-...`, `emc-...`, `sec-...`), which would throw a Postgres runtime casting error: `ERROR: invalid input syntax for type uuid`.
- **Remediation:** Changed `id` column definition to `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`.

### Bug #3: Rigid Unique Constraint in Pending Email Changes (High)
- **Location:** `supabase/migrations/0021_emailjs_otp_and_notifications.sql`
- **Issue:** `CONSTRAINT uq_pending_email_change_user UNIQUE (user_id, status)` prevented users from having multiple historical 'completed', 'expired', or 'cancelled' email change records.
- **Remediation:** Replaced with a partial unique index:
  `CREATE UNIQUE INDEX uq_active_pending_email_change ON public.pending_email_changes (user_id) WHERE status IN ('pending', 'old_verified');`.

### Bug #4: Silently Swallowed Supabase Auth Update Error (Medium)
- **Location:** `lib/server/services/email-change.ts`
- **Issue:** If `admin.auth.admin.updateUserById` failed during email change, it only logged a console warning and marked the change as completed in local database, causing desynchronization.
- **Remediation:** Added explicit error check throwing `AuthError` on failure so the user is informed and rollback occurs.

### Bug #5: Missing Mobile Authentication API Exports (Medium)
- **Location:** `mobile/src/services/api.ts`
- **Issue:** Mobile UI screens imported `requestPasswordReset`, `verifyPasswordResetOtp`, `completePasswordReset`, `requestMobileEmailChange`, `verifyMobileOldEmailOtp`, and `verifyMobileNewEmailOtp`, but these functions were missing from the mobile API service file.
- **Remediation:** Implemented and exported all 6 methods in `mobile/src/services/api.ts` with timeout handling and error formatting.
