# Security Audit Report — DSVV CSMS

**Date:** 2026-11-27

## 1. Authentication & Role-Based Access Control
- Roles strictly separated: `super_admin`, `admin`, `security`, `teacher`, `student`, `visitor`.
- `middleware.ts` enforces portal routing hints; every API route independently enforces `requireRole(...)` (`ADMIN_ROLES`, `GATE_ROLES`, `STAFF_ROLES`, `ALL_ROLES`).
- Self-registration (`POST /api/guards/register`) cannot assign roles; creates `PENDING` request and disabled `profiles.active = false` account until explicit Admin approval.

## 2. Security Fixes Applied
- `GET /api/guards/status`: Added `401` session check and `403` self-only restriction for non-admins.
- `GET /api/guards/registrations`: Restricted from `GATE_ROLES` to `ADMIN_ROLES`; stripped `password_hash` and `password_salt` from Supabase query & response mapping.
- `createGuardRegistrationRequest`: Moved duplicate email/phone checks inside SQLite `tx()` + added Supabase pre-checks to prevent TOCTOU races.
- `password_reset_otps`: Hashed with `scrypt` + 16-byte random salt, 5-minute expiry, 60s resend cooldown, max 5 verification attempts, single-use invalidation, and HMAC-SHA256 signed recovery tokens.

## 3. Secrets & RLS Hygiene
- `.gitignore` excludes `.env*`, `.data`, `.vercel`, `supabase/.temp/`.
- `.vercelignore` excludes `backend/`, `mobile/`, `.data/`, `tests/`.
- `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are server-only (`import "server-only"`) and never bundled into web client or mobile APK.
- Supabase RLS enabled across all tables (`0002_rls.sql`, `0008`, `0019`, `0020`, `0021`, `0022`).
