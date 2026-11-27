# Deployment Report — DSVV CSMS

**Date:** 2026-11-27

## 1. Vercel Production Deployment
- **URL:** `https://campus-security-management.vercel.app`
- **Plan:** Vercel Hobby (<= 12 Serverless Functions constraint satisfied via `app/api/[...route]/route.ts` consolidating 88 API routes into 1 Serverless Function)
- **Active Deployment:** `dpl_CjwzdjG5GdnexEouW7KBfT6WGfyN` (`READY`) — note: final `otp.ts` / `auth.ts` serverless OTP fix will deploy automatically on push to `main` or via `vercel --prod`.
- **`.vercelignore`:** Verified `backend/`, `mobile/`, `.data/`, `tests/` are excluded safely without affecting Next.js runtime.

## 2. Supabase Production (`qpamgfhggxwctoibmsbl`)
- Migrations `0001`–`0022` applied cleanly (`supabase db push --include-all`).
- Vercel Production env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) aligned to `qpamgfhggxwctoibmsbl`.

## 3. Android APK Release Artifact
- **Path:** `mobile/android/app/build/outputs/apk/release/Security.apk`
- **Size:** 54,872,423 bytes
- **Package ID:** `com.dsvv.campussecurity` (`Security`, v1.0.0)
- **Backend URL:** `https://campus-security-management.vercel.app`
