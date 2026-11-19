# Campus Security Management System
## Dashboard URLs & Login Credentials Reference

**Institution:** Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar  
**System:** Campus Security Management System (CSMS)  
**Document Version:** 1.0  
**Generated:** November 2026  
**Environment:** Development / Evaluation

---

> [!IMPORTANT]
> This document contains **development/demo credentials only**. These are seeded accounts for system evaluation. Remove all demo accounts and rotate all keys before going live with real campus data.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [All Dashboard URLs](#all-dashboard-urls)
3. [Login Pages Reference](#login-pages-reference)
4. [Demo Login Credentials](#demo-login-credentials)
5. [Role-Based Access Matrix](#role-based-access-matrix)
6. [Public Routes](#public-routes)
7. [Authentication API Endpoints](#authentication-api-endpoints)
8. [Password Reset Instructions](#password-reset-instructions)
9. [Session & Security Notes](#session--security-notes)

---

## 1. System Overview

CSMS is a Next.js 14 (App Router) web application backed by:

| Component | Details |
|-----------|---------|
| **Primary Auth** | Supabase Auth (email + password) |
| **Fallback Auth** | SQLite (`app_users` + `sessions` tables) |
| **Session Cookie** | `csms_session` (httpOnly, 12-hour expiry) |
| **Role Cookie** | `csms_role` (routing hint only — not trusted for data access) |
| **API Protection** | `requireRole()` on every server-side API route |
| **Middleware Guard** | Edge middleware validates prefix against allowed roles |
| **Database** | Supabase PostgreSQL + SQLite (local) |
| **Supabase Project** | `https://qpamgfhggxwctoibmsbl.supabase.co` |

---

## 2. All Dashboard URLs

### 2.1 Super Administrator Dashboard

| Item | URL |
|------|-----|
| **Login Page** | `/super-admin/login` |
| **Dashboard Home** | `/super-admin/dashboard` |
| **Role Required** | `super_admin` only |
| **Protected** | ✅ Yes — middleware + server-side `requireRole()` |
| **Status** | ✅ Fully Implemented |

### 2.2 Administrator Dashboard

| Item | URL |
|------|-----|
| **Login Page** | `/admin/login` |
| **Dashboard Home** | `/admin/dashboard` |
| **Role Required** | `admin`, `super_admin` |
| **Protected** | ✅ Yes |
| **Status** | ✅ Fully Implemented |

**Admin sub-pages:**

| Module | URL |
|--------|-----|
| Activity Log | `/admin/activity` |
| Bookings | `/admin/bookings` |
| Check-In / Out | `/admin/checkin` |
| Emergency | `/admin/emergency` |
| Gates | `/admin/gates` |
| Guard Duty | `/admin/guard-duty` |
| Guards | `/admin/guards` |
| Incidents | `/admin/incidents` |
| Meetings | `/admin/meetings` |
| Notifications | `/admin/notifications` |
| Reports | `/admin/reports` |
| Requests | `/admin/requests` |
| Settings | `/admin/settings` |
| Students | `/admin/students` |
| Teachers | `/admin/teachers` |
| Vehicles | `/admin/vehicles` |
| Visitors | `/admin/visitors` |

### 2.3 Security Guard Dashboard

| Item | URL |
|------|-----|
| **Login Page** | `/security/login` |
| **Dashboard Home** | `/security/dashboard` |
| **Role Required** | `security`, `admin`, `super_admin` |
| **Protected** | ✅ Yes |
| **Status** | ✅ Fully Implemented |

**Security Guard sub-pages:**

| Module | URL |
|--------|-----|
| Check-In | `/security/check-in` |
| Check-Out | `/security/check-out` |
| Emergency | `/security/emergency` |
| Shift Handover | `/security/handover` |
| Incidents | `/security/incidents` |
| Patrol | `/security/patrol` |
| Profile | `/security/profile` |
| QR Scan | `/security/scan` |
| Schedule | `/security/schedule` |
| Vehicles | `/security/vehicles` |

### 2.4 Teacher / Faculty Portal

| Item | URL |
|------|-----|
| **Login Page** | `/teacher` *(serves both landing and login prompt)* |
| **Dashboard Home** | `/teacher/dashboard` |
| **Index Redirect** | `/teacher` → redirects to `/teacher/dashboard` |
| **Role Required** | `teacher`, `admin`, `super_admin` |
| **Protected** | ✅ Yes |
| **Status** | ✅ Fully Implemented |

**Teacher sub-pages:**

| Module | URL |
|--------|-----|
| Availability | `/teacher/availability` |
| Meetings | `/teacher/meetings` |
| Profile | `/teacher/profile` |

### 2.5 Student Portal

| Item | URL |
|------|-----|
| **Login Page** | `/login` *(shared login — redirects to `/student` after auth)* |
| **Portal Home** | `/student` |
| **Role Required** | `student` |
| **Protected** | ✅ Yes (session-based) |
| **Status** | ✅ Implemented |

### 2.6 Visitor Portal

| Item | URL |
|------|-----|
| **Landing** | `/` *(site home — visitor portal integrated)* |
| **Legacy Redirect** | `/visitor` → redirects to `/` |
| **Book a Visit** | `/visitor/book` |
| **Help** | `/visitor/help` |
| **My Pass** | `/visitor/pass` |
| **Pass Detail** | `/visitor/pass/[id]` |
| **Status Check** | `/visitor/status` |
| **Role Required** | `visitor` (or unauthenticated for public booking) |
| **Status** | ✅ Fully Implemented |

### 2.7 Faculty Visit Decision Page

| Item | URL |
|------|-----|
| **Decision Page** | `/faculty/decision` |
| **Purpose** | Faculty approves/denies a visitor meeting request via email token link |
| **Auth Required** | Token-based (no login required — link sent by email/WhatsApp) |
| **Status** | ✅ Implemented |

### 2.8 Visit Verification

| Item | URL |
|------|-----|
| **QR Token Verify** | `/visit/verify/[token]` |
| **Purpose** | Verifies visitor QR code (also accessible from security scan) |
| **Auth Required** | No (public verification endpoint) |
| **Status** | ✅ Implemented |

---

## 3. Login Pages Reference

| Role | Login URL | Notes |
|------|-----------|-------|
| Super Admin | `/super-admin/login` | Dedicated portal; only `super_admin` role admitted |
| Admin | `/admin/login` | Dedicated portal; `admin` + `super_admin` roles admitted |
| Security Guard | `/security/login` | Dedicated portal; `security`, `admin`, `super_admin` admitted |
| Teacher/Faculty | `/teacher` | Integrated teacher landing; redirects to dashboard on auth |
| Student | `/login` | Shared login page; session redirects to `/student` |
| Visitor (self-registered) | `/login` or `/signup` | Shared auth; redirects to `/` after login |
| Generic Shared Login | `/login` | Redirects authenticated users to their role's dashboard |
| Sign Up | `/signup` | New user registration (visitor/student roles only — admin roles restricted) |
| Forgot Password | `/forgot-password` | 3-step OTP flow: email → OTP → new password |
| Reset Password | `/reset-password` | Token-based reset (via email link from Supabase) |

---

## 4. Demo Login Credentials

> [!CAUTION]
> **Development use only.** These accounts and passwords are seeded into the local SQLite database. Do not use in production. Rotate before launch.

The global demo password override can be set in `.env.local`:
```
DEMO_ACCOUNT_PASSWORD=Admin@123
```
When this is set, **all demo accounts use `Admin@123`** as their password.  
When it is NOT set, each account uses its individual default password listed below.

### 4.1 Administrator Accounts

| Role | Name | Email | Default Password | Login URL |
|------|------|-------|-----------------|-----------|
| **Super Admin** | Campus Security Director | `superadmin@dsvv.edu.in` | `Super@123` | `/super-admin/login` |
| **Super Admin** | Nikhil Shukla *(project owner)* | `nikhilshukla1200@gmail.com` | `Admin@123` | `/super-admin/login` |
| **Admin** | Security Administrator | `admin@dsvv.edu.in` | `Admin@123` | `/admin/login` |

> **Note:** Migration `0009_admin_email_restriction.sql` restricts Supabase `admin` role assignment to `nikhilshukla1200@gmail.com`. Other admin accounts operate via SQLite fallback auth.

### 4.2 Security Guard Accounts

| ID | Name | Email | Gate | Default Password | Login URL |
|----|------|-------|------|-----------------|-----------|
| GRD-001 | Amit Kumar | `security@dsvv.edu.in` | Main Gate | `Security@123` | `/security/login` |
| GRD-002 | Sunil Thapa | `sunil.thapa@dsvv.edu.in` | Main Gate | `Security@123` | `/security/login` |
| GRD-004 | Pooja Rawat | `pooja.rawat@dsvv.edu.in` | Hostel Gate | `Security@123` | `/security/login` |

### 4.3 Teacher / Faculty Accounts

| ID | Name | Email | Department | Default Password | Login URL |
|----|------|-------|-----------|-----------------|-----------|
| TCH-008 | Dr. Rajeshwari Trivedi | `rajeshwari.trivedi@dsvv.ac.in` | Education | `Teacher@123` | `/teacher` |
| TCH-001 | Dr. Narendra Pratap Singh | `np.singh@dsvv.ac.in` | Yogic Science | `Teacher@123` | `/teacher` |
| — | Dr. Anupama Sharma | `anupama.sharma@dsvv.edu.in` | — | `Teacher@123` | `/teacher` |

### 4.4 Student Account

| ID | Name | Email | Default Password | Login URL |
|----|------|-------|-----------------|-----------|
| STU-2026-001 | Aarav Mehta | `aarav.mehta@dsvv.edu.in` | `Student@123` | `/login` |

### 4.5 Visitor Account

| Name | Email | Default Password | Login URL |
|------|-------|-----------------|-----------|
| Rahul Sharma | `visitor@dsvv.edu.in` | `Admin@123` *(when DEMO_ACCOUNT_PASSWORD set)* | `/login` |

> **Note:** The visitor demo account is defined in `lib/demo-accounts.ts` for UI one-tap fill but may not be seeded in `lib/server/seed.ts`. Visitors typically register themselves via `/signup`.

---

## 5. Role-Based Access Matrix

| Portal / Route Prefix | super_admin | admin | security | teacher | student | visitor |
|-----------------------|:-----------:|:-----:|:--------:|:-------:|:-------:|:-------:|
| `/super-admin/*` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/*` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/security/*` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/teacher/*` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/student` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/visitor/*` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/faculty/decision` | — | — | — | — | — | — |
| `/visit/verify/*` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `/login`, `/signup` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| Public pages (`/`, `/about`, etc.) | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |

**Legend:**  ✅ Allowed  ❌ Denied (403 / redirect to role login)  🌐 Public (no auth required)  — Token-based

> [!NOTE]
> The middleware is a **usability routing layer**, not the sole security boundary. Every API route independently validates the session using `requireRole()` server-side. Role enforcement has 5 layers: Supabase role check → middleware edge routing → server layout guard → client shell 403 UI → server-side `requireRole()`.

---

## 6. Public Routes

These pages are accessible without any login:

| Route | Description |
|-------|-------------|
| `/` | Site home / Visitor portal landing |
| `/about` | About DSVV |
| `/academics` | Academics overview |
| `/campus` | Campus information |
| `/facilities` | Facilities |
| `/(public)/pre-book-visit` | Pre-book a campus visit |
| `/(public)/visitor-guide` | Visitor guide |
| `/(public)/booking-status` | Check booking status (by reference number) |
| `/visit/verify/[token]` | QR code / pass token verification |
| `/faculty/decision` | Faculty visit approve/deny (token auth) |
| `/login` | Shared login (redirects by role after auth) |
| `/signup` | New user registration |
| `/forgot-password` | Password recovery (OTP flow) |
| `/reset-password` | Password reset (token-based) |

---

## 7. Authentication API Endpoints

All endpoints are located under `/api/auth/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Email + password login; sets `csms_session` + `csms_role` cookies |
| `/api/auth/logout` | POST | Clears session cookies |
| `/api/auth/signup` | POST | New user registration (visitor/student roles only) |
| `/api/auth/forgot-password` | POST | Sends 6-digit OTP to email via Resend API |
| `/api/auth/verify-otp` | POST | Verifies OTP; returns short-lived recovery token |
| `/api/auth/resend-otp` | POST | Resends OTP (60-second cooldown enforced) |
| `/api/auth/reset-password` | POST | Resets password using recovery token + OTP |
| `/api/auth/session` | GET | Returns current session info (role, name, email) |

### Login Request Format
```json
POST /api/auth/login
{
  "email": "admin@dsvv.edu.in",
  "password": "Admin@123",
  "expectedRole": "admin"
}
```

The `expectedRole` field enforces portal-specific login — if the user's actual database role does not match, login is rejected with:
> *"You are not authorized to access this login portal."*

---

## 8. Password Reset Instructions

### Via Forgot Password Flow (OTP)

1. Go to `/forgot-password`
2. Enter your registered email address
3. Receive a 6-digit OTP via email (requires `RESEND_API_KEY` to be configured in `.env.local`)
4. Enter the OTP on the next screen (valid for 10 minutes; max 5 attempts; 60-second resend cooldown)
5. Enter and confirm your new password
6. Sign in with the new password

> [!WARNING]
> OTP email delivery requires the Resend API to be configured:
> ```
> RESEND_API_KEY=re_your_key_here
> RESEND_FROM_EMAIL=security@dsvv.ac.in
> RESEND_ENABLE_DEVELOPMENT_DELIVERY=true   # required in localhost dev
> ```
> Without these settings, OTP emails are silently dropped. The Resend dashboard at [resend.com](https://resend.com) shows email delivery logs.

### Via Admin (direct reset)

Super Admins can manually reset user passwords through the Admin dashboard user management section.

---

## 9. Session & Security Notes

| Property | Value |
|----------|-------|
| **Session cookie name** | `csms_session` |
| **Session duration** | 12 hours (server-side expiry) |
| **Cookie flags** | `httpOnly`, `SameSite=Lax`, `Secure` (in production) |
| **Role cookie** | `csms_role` — routing hint only, never trusted for data |
| **OTP expiry** | 10 minutes |
| **OTP max attempts** | 5 per request |
| **OTP resend cooldown** | 60 seconds |
| **Password hashing** | scrypt (via `hashPassword()` in `lib/server/password.ts`) |
| **Admin role restriction** | Supabase admin restricted to `nikhilshukla1200@gmail.com` via migration |
| **Role self-assignment** | Blocked — signup only allows `visitor` or `student` roles |
| **API security** | Every route calls `requireRole()` server-side independently of middleware |

### Post-Login Redirect Map

| Role | Redirected To |
|------|---------------|
| `super_admin` | `/super-admin/dashboard` |
| `admin` | `/admin/dashboard` |
| `security` | `/security/dashboard` |
| `teacher` | `/teacher/dashboard` |
| `student` | `/student` |
| `visitor` | `/` *(site home / visitor portal)* |

---

## Appendix: File Locations

| Purpose | File Path |
|---------|-----------|
| Demo account list (UI) | `lib/demo-accounts.ts` |
| Seed data & accounts | `lib/server/seed.ts` |
| Auth business logic | `lib/server/auth.ts` |
| OTP service | `lib/server/services/otp.ts` |
| Email service | `lib/server/services/email.ts` |
| Middleware (routing) | `middleware.ts` |
| Login API route | `app/api/auth/login/route.ts` |
| Forgot password screen | `components/auth/forgot-password-screen.tsx` |
| Auth provider | `components/providers/auth-provider.tsx` |
| Environment template | `.env.example` |
| Local environment | `.env.local` *(not committed to git)* |

---

*Document generated from live project inspection of `c:\Users\DELL\campus security mangement system`.*  
*All URLs verified from route directory structure and middleware configuration.*  
*Credentials verified from `lib/server/seed.ts` DEMO_ACCOUNTS array.*
