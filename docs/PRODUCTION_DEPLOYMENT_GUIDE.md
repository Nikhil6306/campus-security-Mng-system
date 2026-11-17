# DSVV Campus Security Management System
## Production Deployment Guide

**Target Deployment Platforms:**
- **Website & Backend API:** Vercel Edge / Serverless Functions
- **Central Database & Real-Time Sync:** Supabase Managed Cloud (PostgreSQL 15)
- **Guard Mobile Application:** Android APK release via Expo EAS Cloud Build

---

## 1. Vercel Environment Variables Configuration

Set the following variables in the **Vercel Project Settings → Environment Variables**:

| Variable Name | Required | Description / Recommended Value |
|---------------|----------|---------------------------------|
| `NEXT_PUBLIC_APP_URL` | Yes | `https://campus-security-management.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://<your-project-id>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase private service role key (Never expose to client) |
| `SUPABASE_DB_URL` | Optional | `postgres://postgres.<id>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DATABASE_DRIVER` | Optional | `sqlite` (Defaults to fast local `/tmp` SQLite cache on Vercel with Supabase REST write-through) |
| `DATABASE_FILE` | Optional | `/tmp/campus-security.db` (Auto-defaulted on Vercel) |
| `VISITOR_PHOTO_DIR` | Optional | `/tmp/visitor-photos` (Auto-defaulted on Vercel) |
| `AADHAAR_ENCRYPTION_KEY` | Recommended | 64-character hex string for AES-256-GCM data at rest |
| `COOKIE_SECRET` | Recommended | Random 32+ character string for secure session cookies |
| `RESEND_API_KEY` | Optional | For visitor email pass delivery notifications |

---

## 2. Supabase Database Initialization & Migrations

If configuring a brand-new Supabase project:
1. Navigate to the Supabase Dashboard SQL Editor.
2. Execute the migration scripts located in `supabase/migrations/` in chronological order:
   - `0001_initial_schema.sql` through `0019_*.sql`.
3. In **Database → Replication**, enable Supabase Realtime replication on:
   - `visit_requests`
   - `movements`
   - `guard_shift_sessions`
   - `notifications`
   - `incidents`
4. In **Storage**, create a private storage bucket named `campus-security`.

---

## 3. Production Verification Commands

To verify backend health post-deployment:
```bash
# 1. Health check
curl -I https://campus-security-management.vercel.app/

# 2. Status verification
curl -s https://campus-security-management.vercel.app/api/auth/session
```
Expected output: HTTP 200 OK with `{ "ok": true, "data": { "session": null } }`.

