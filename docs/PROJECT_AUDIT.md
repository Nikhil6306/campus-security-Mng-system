# Project Architecture Audit — DSVV Campus Security Management System (CSMS)

**Date:** 2026-11-27  
**Repository:** `https://github.com/Nikhil6306/campus-security-Mng-system.git` (`main`)  
**Production URL:** `https://campus-security-management.vercel.app`  
**Supabase Project:** `qpamgfhggxwctoibmsbl`  
**Android App:** `Security` (`com.dsvv.campussecurity`)

---

## 1. System Architecture
- **Frontend & API Backend:** Next.js 15 App Router (`app/`), Tailwind CSS, shadcn/ui, Lucide React icons.
- **API Consolidation:** All 88 API handlers live in `lib/api-routes/**` and are dispatched via a single Next.js 15 catch-all route (`app/api/[...route]/route.ts`) to stay within Vercel Hobby's 12-Serverless-Function limit.
- **Primary Database & Auth:** Supabase PostgreSQL + Supabase Auth (`auth.users` + `public.profiles`), with `campus-security` private storage bucket.
- **Offline Cache & Outbox:** SQLite (`node:sqlite`, `/tmp/campus-security.db` on Vercel) used only as an ephemeral cache and `sync_outbox` queue for offline resilience.
- **Email Service:** Resend (`lib/server/services/email.ts`) — EmailJS is not used in the codebase.
- **Mobile Application:** Expo / React Native (`mobile/`) targeting `com.dsvv.campussecurity` (`Security`).

## 2. Module Status Summary
| Module | Status | Notes |
|---|---|---|
| Role-Based Auth & Profiles | ✅ Working | `super_admin`, `admin`, `security`, `teacher`, `student`, `visitor` |
| Guard Registration & Approval | ✅ Working | 4-field registration, Supabase persistence, Admin approval workflow |
| Forgot Password & Email OTP | ✅ Working | 6-digit hashed OTP, 5-min expiry, 60s cooldown, 5-attempt limit, stateless HMAC recovery token + Supabase persistence |
| Visitor Pre-Booking & QR Pass | ✅ Working | Opaque pass token, SHA-256 hash verification, Aadhaar encryption |
| Gate Check-In / Check-Out | ✅ Working | Atomic state transitions, duplicate check-in prevention |
| Mobile Android APK | ✅ Working | Built (`Security.apk`), installed and launched on `RMX3263` (`1A19263210BA09GU`) |
| Email Delivery (Resend) | ⚠️ Env Pending | Code safe and verified; requires `RESEND_API_KEY` + `RESEND_FROM_EMAIL` in Vercel Production env |
