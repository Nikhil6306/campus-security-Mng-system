# Supabase Database & RLS Audit
## DSVV Campus Security Management System (CSMS)

---

## 1. Table Schemas & Constraints Review

### A. `public.auth_email_otps`
- **Columns:**
  - `id`: `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`
  - `user_id`: `UUID REFERENCES auth.users(id) ON DELETE CASCADE`
  - `email`: `TEXT NOT NULL`
  - `otp_hash`: `TEXT NOT NULL`
  - `otp_salt`: `TEXT NOT NULL`
  - `purpose`: `TEXT CHECK (purpose IN ('signup_verification', 'password_reset', 'email_change_old', 'email_change_new', 'login_verification'))`
  - `expires_at`: `TIMESTAMPTZ NOT NULL`
  - `attempts`: `INTEGER NOT NULL DEFAULT 0`
  - `max_attempts`: `INTEGER NOT NULL DEFAULT 5`
  - `verified_at`: `TIMESTAMPTZ`
  - `consumed_at`: `TIMESTAMPTZ`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`

### B. `public.pending_email_changes`
- **Columns:**
  - `id`: `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`
  - `user_id`: `UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `old_email`: `TEXT NOT NULL`
  - `new_email`: `TEXT NOT NULL`
  - `old_email_verified_at`: `TIMESTAMPTZ`
  - `new_email_verified_at`: `TIMESTAMPTZ`
  - `status`: `TEXT NOT NULL CHECK (status IN ('pending', 'old_verified', 'new_verified', 'completed', 'expired', 'cancelled'))`
  - `expires_at`: `TIMESTAMPTZ NOT NULL`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `completed_at`: `TIMESTAMPTZ`
- **Index:** `CREATE UNIQUE INDEX uq_active_pending_email_change ON public.pending_email_changes (user_id) WHERE status IN ('pending', 'old_verified');`

---

## 2. Row Level Security (RLS) Policies

| Table | Policy Name | Command | Role | Expression |
| :--- | :--- | :--- | :--- | :--- |
| `auth_email_otps` | "Service role manages auth otps" | ALL | `service_role` | `USING (true) WITH CHECK (true)` |
| `auth_email_otps` | "No public access to auth otps" | ALL | `anon, authenticated` | `USING (false) WITH CHECK (false)` |
| `email_notifications` | "Service role manages email notifications" | ALL | `service_role` | `USING (true) WITH CHECK (true)` |
| `email_notifications` | "Users can view own email notifications" | SELECT | `authenticated` | `USING (user_id = auth.uid())` |
| `account_security_logs`| "Service role manages security logs" | ALL | `service_role` | `USING (true) WITH CHECK (true)` |
| `account_security_logs`| "Users can view own security logs" | SELECT | `authenticated` | `USING (user_id = auth.uid())` |
| `pending_email_changes`| "Service role manages pending email changes" | ALL | `service_role` | `USING (true) WITH CHECK (true)` |
| `pending_email_changes`| "Users can view own pending email changes" | SELECT | `authenticated` | `USING (user_id = auth.uid())` |

**Security Finding:**
Direct client access (via `anon` or `authenticated` roles) to read or tamper with OTP hashes is blocked (`USING (false)`). All OTP verification and creation operations run strictly via secure backend server routes using the `service_role` key.
