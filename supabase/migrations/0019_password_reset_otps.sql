-- ============================================================================
-- Migration: 0019_password_reset_otps.sql
-- Description: Password reset OTP tracking, verification attempts and cooldowns
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  otp_hash     TEXT NOT NULL,
  salt         TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reset_otps_email ON public.password_reset_otps(lower(email));
CREATE INDEX IF NOT EXISTS idx_reset_otps_expiry ON public.password_reset_otps(expires_at);

-- Enable Row Level Security
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Service role has full management privileges
DROP POLICY IF EXISTS "Service role manages password reset otps" ON public.password_reset_otps;
CREATE POLICY "Service role manages password reset otps"
  ON public.password_reset_otps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anonymous or public users CANNOT query OTP hashes or salts directly
DROP POLICY IF EXISTS "Public cannot read OTP records" ON public.password_reset_otps;
CREATE POLICY "Public cannot read OTP records"
  ON public.password_reset_otps
  FOR SELECT
  TO anon, authenticated
  USING (false);
