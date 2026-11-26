# EmailJS & Auth Bug Fix Report
## DSVV Campus Security Management System (CSMS)
**Date:** 26 November 2026

---

## 1. Summary of Fixes

| Issue ID | Severity | File Affected | Description of Fix |
| :--- | :--- | :--- | :--- |
| **FIX-01** | **CRITICAL** | `app/api/auth/reset-password/route.ts` | Prioritized OTP verification over ambient session cookies whenever an email target is submitted. Blocked direct password reset without OTP. |
| **FIX-02** | **CRITICAL** | `supabase/migrations/0021_emailjs_otp_and_notifications.sql` | Modified `id` columns from `UUID` to `TEXT DEFAULT gen_random_uuid()::text` to prevent PostgreSQL runtime type mismatch with application-generated IDs. |
| **FIX-03** | **HIGH** | `supabase/migrations/0021_emailjs_otp_and_notifications.sql` | Removed table-level `UNIQUE (user_id, status)` constraint and added partial unique index on `(user_id) WHERE status IN ('pending', 'old_verified')` to allow unlimited historical audit logs. |
| **FIX-04** | **MEDIUM** | `lib/server/services/email-change.ts` | Disallowed silent failure when updating email in Supabase Auth; throws `AuthError` on failure to maintain exact consistency between Auth and profiles. |
| **FIX-05** | **MEDIUM** | `mobile/src/services/api.ts` | Exported missing mobile API methods (`requestPasswordReset`, `verifyPasswordResetOtp`, `completePasswordReset`, `requestMobileEmailChange`, `verifyMobileOldEmailOtp`, `verifyMobileNewEmailOtp`). |

---

## 2. Detailed Technical Fixes

### Fix #1: Password Reset API Isolation
```typescript
// app/api/auth/reset-password/route.ts
let token: string | undefined;

// 1. If email + otp are provided in body, verify OTP directly (preferred and secure)
if (input.email && input.otp) {
  const verification = await verifyPasswordResetOtp(input.email, input.otp);
  token = verification.recoveryToken;
} else if (input.email && !input.otp) {
  // Explicitly reject attempts to bypass OTP when specifying an email
  throw new AuthError("Verification code (OTP) is required to reset password for this email.", 400);
} else {
  // 2. Otherwise fall back to Authorization header or session cookie
  const authHeader = request.headers.get("authorization");
  token = authHeader?.replace(/^Bearer\s+/i, "")?.trim();
  if (!token) {
    const store = await cookies();
    token = store.get(SESSION_COOKIE)?.value;
  }
}
```

### Fix #2: Supabase Partial Indexing for Email Changes
```sql
-- supabase/migrations/0021_emailjs_otp_and_notifications.sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_pending_email_change
  ON public.pending_email_changes (user_id)
  WHERE status IN ('pending', 'old_verified');
```
