# Campus Security Management System (CSMS)
## Production Deployment Guide

**Institution:** Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar  
**Target Environments:** Vercel (Edge & Serverless) / Supabase Cloud (PostgreSQL 15+) / Android Standalone APK  
**Production URL:** `https://campus-security-management.vercel.app`

---

## 1. Architecture Deployment Overview

```mermaid
graph LR
    subgraph Vercel Cloud
        Web[Next.js 15 Frontend<br/>App Router & UI]
        API[Serverless API Handlers<br/>/api/* & Auth]
        Edge[Edge Middleware<br/>middleware.ts]
    end

    subgraph Supabase Cloud
        Postgres[(PostgreSQL 15 Database<br/>RLS & Migrations)]
        Storage[(campus-security Bucket<br/>Visitor Photographs)]
        Realtime[Realtime Subscriptions<br/>Live Updates]
    end

    subgraph Mobile Devices
        AndroidApp[Guard Android APK<br/>com.dsvv.campussecurity]
    end

    Web --> Edge
    Edge --> API
    API -->|REST / PostgREST| Postgres
    API -->|S3 Protocol| Storage
    AndroidApp -->|HTTPS API| API
    Realtime -.-> Web
```

---

## 2. Vercel Deployment Instructions

### 2.1 Git Integration
1. Push repository changes to the `main` branch of `https://github.com/Nikhil6306/campus-security-Mng-system.git`.
2. Connect the repository in the **Vercel Dashboard**.
3. Framework Preset: **Next.js** (auto-detected).
4. Node.js Version: **20.x** or **24.x**.
5. Build Command: `next build` (or default `npm run build`).
6. Output Directory: `.next` (default).

### 2.2 Required Environment Variables on Vercel
Configure these in **Vercel Project Settings → Environment Variables**:

| Variable Name | Required | Example / Recommended Setting | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `https://campus-security-management.vercel.app` | Canonical public application URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | `https://qpamgfhggxwctoibmsbl.supabase.co` | Supabase Cloud project endpoint. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | `eyJhbGciOi...` | Supabase public anonymous API key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | `eyJhbGciOi...` | Supabase private administrative key (Never expose in client code). |
| `SUPABASE_DB_URL` | Optional | `postgres://postgres.xxx:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true` | Transaction pooled direct PostgreSQL connection string. |
| `DATABASE_DRIVER` | Optional | `sqlite` | Defaults to local `/tmp` SQLite cache on Vercel with Supabase REST dual-writing. |
| `DATABASE_FILE` | Optional | `/tmp/campus-security.db` | Local database path inside serverless container. |
| `VISITOR_PHOTO_DIR` | Optional | `/tmp/visitor-photos` | Local temporary directory for image processing. |
| `AADHAAR_ENCRYPTION_KEY` | Recommended | `64-character-hex-string` | Secret key for AES-256-GCM encryption of sensitive identity fields. |
| `COOKIE_SECRET` | Recommended | `random-32-char-string` | Cryptographic secret for signing session cookies. |
| `RESEND_API_KEY` | Optional | `re_123456789...` | API key for transactional email delivery (Resend). |
| `RESEND_FROM_EMAIL` | Optional | `security@dsvv.ac.in` | Verified sender email address. |
| `WHATSAPP_ACCESS_TOKEN` | Optional | `EAAx...` | Meta Graph API access token for WhatsApp Business. |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | `123456789012345` | Meta Cloud Phone Number ID. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Optional | `random-verify-token` | Verification token for inbound WhatsApp webhooks. |

---

## 3. Supabase Cloud Configuration

### 3.1 Applying Migrations
Execute all migration files in `supabase/migrations/` sequentially using the Supabase SQL Editor:
1. `0001_schema.sql` through `0019_password_reset_otps.sql`.
2. Confirm all tables, foreign keys, and indexes are created.

### 3.2 Private Storage Bucket Setup
1. In Supabase Dashboard, go to **Storage**.
2. Create a new bucket named `campus-security`.
3. Set bucket access to **Private** (public downloads disabled).
4. Apply storage policy allowing authenticated backend service role to insert and read objects.

### 3.3 Realtime Replication
In **Database → Replication**, enable Realtime replication for:
* `visit_requests`
* `check_logs`
* `guard_shift_sessions`
* `notifications`
* `incidents`

---

## 4. Post-Deployment Verification & Health Checks

Verify your deployment using these terminal commands:

```bash
# 1. Verify Homepage returns HTTP 200 OK
curl -I https://campus-security-management.vercel.app/

# 2. Verify Session API returns expected anonymous response
curl -s https://campus-security-management.vercel.app/api/auth/session
# Expected output: {"ok":true,"data":{"session":null}}

# 3. Verify Public Slots API
curl -s "https://campus-security-management.vercel.app/api/public/slots?date=2026-11-25"
# Expected output: {"ok":true,"data":[...]}

# 4. Verify Gate Scanner endpoint responds with 401 (unauthorized) for unauthenticated requests
curl -I -X POST https://campus-security-management.vercel.app/api/gate/verify
# Expected output: HTTP 401 Unauthorized
```
