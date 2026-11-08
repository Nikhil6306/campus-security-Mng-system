# Campus Security Management System (CSMS)
## Enterprise Production Deployment Guide

**Target Environment:** Vercel (Web Frontend & API) + Supabase Cloud (PostgreSQL, Auth, Storage) + Native Android (Mobile App)  
**Security Level:** Enterprise Grade / Strict Data Isolation  

---

## 1. Cloud Architecture Overview

The production system runs across two primary cloud tiers:
1. **Application Server (Vercel):** Next.js 15 App Router running on Node 24 runtime with edge distribution.
2. **Database & Storage Tier (Supabase Cloud):** Managed PostgreSQL 15+ database with Row Level Security, Supabase Auth user management, and encrypted object storage for visitor photos.

---

## 2. Environment Variables Configuration

Set these production variables in Vercel Project Settings (and in local `.env.local` for staging):

```ini
# Application URLs
NEXT_PUBLIC_APP_URL=https://campus-security.dsvv.edu.in
NEXT_PUBLIC_SITE_URL=https://campus-security.dsvv.edu.in

# Supabase PostgreSQL & Connection Pooler
DATABASE_DRIVER=postgres
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]

# Cryptography & Aadhaar Protection
AADHAAR_ENCRYPTION_KEY=[32-BYTE-BASE64-KEY]

# Meta WhatsApp Cloud API
WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=[SYSTEM-USER-ACCESS-TOKEN]
WHATSAPP_PHONE_NUMBER_ID=[PHONE-NUMBER-ID]
WHATSAPP_BUSINESS_ACCOUNT_ID=[WABA-ID]
WHATSAPP_WEBHOOK_VERIFY_TOKEN=[WEBHOOK-SECRET]
WHATSAPP_WEBHOOK_APP_SECRET=[META-APP-SECRET]

# Email Delivery (Resend)
RESEND_API_KEY=[RESEND-API-KEY]
RESEND_FROM_EMAIL=security@dsvv.edu.in
RESEND_ENABLE_DEVELOPMENT_DELIVERY=true
```

---

## 3. Database Migration Deployment to Supabase

Apply the version-controlled SQL migrations in sequence using the Supabase CLI or SQL Query Editor:

```bash
# Using Supabase CLI:
supabase link --project-ref [PROJECT_REF]
supabase db push
```

Or execute migrations `0001` through `0018` in numeric order:
1. `0001_schema.sql` through `0004_fix_triggers.sql`: Core tables, indexes, and trigger functions.
2. `0005_visitor_photos.sql` & `0008_photo_public_read.sql`: Secure storage policies for photos.
3. `0009_admin_email_restriction.sql`: Trigger enforcing authorized administrator accounts.
4. `0010_guard_dashboard.sql` through `0012_gate_in_out_workflow.sql`: Guard shifts and atomic gate RPC procedures.
5. `0013_visitor_registration_fields.sql` through `0018_student_outpass.sql`: Visit details, handovers, WhatsApp tokens, SOS, and outpasses.

---

## 4. Supabase Storage Setup

1. In Supabase Dashboard, create a storage bucket named:
   `campus-security`
2. Set bucket to **Private** (do NOT enable public bucket).
3. The RLS policies in `0005_visitor_photos.sql` ensure only gate operators and authenticated administrators can read photos via signed tokens.

---

## 5. Web Portal Deployment (Vercel)

1. Connect the GitHub repository `https://github.com/Nikhil6306/campus-security-Mng-system.git` to Vercel.
2. Select Framework Preset: **Next.js**.
3. Confirm Node.js Version: **24.x** (configured in `package.json` engines).
4. Build Command: `npm run build`.
5. Deploy. The project compiles 63 static and dynamic routes with zero errors.

---

## 6. Android Mobile App Build & Distribution

### Building Release APK Locally:
```powershell
cd mobile
npx expo prebuild --platform android --clean --no-install
cd android
.\gradlew.bat assembleRelease
```
The compiled APK will be generated at:
`mobile/android/app/build/outputs/apk/release/app-release.apk`

### Building with EAS Cloud (Alternative):
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile release
```
Distribute `app-release.apk` to campus gate mobile devices according to `docs/ANDROID_INSTALLATION_GUIDE.md`.
