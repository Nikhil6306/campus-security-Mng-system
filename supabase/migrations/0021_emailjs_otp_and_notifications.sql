-- ============================================================================
-- Migration: 0021_emailjs_otp_and_notifications.sql
-- Description: EmailJS OTP verification, email notifications, security logs,
--              and pending email changes tables for the DSVV CSMS
-- ============================================================================

-- TABLE A: auth_email_otps
-- Stores hashed OTPs for all purposes (password reset, email change, signup)
CREATE TABLE IF NOT EXISTS public.auth_email_otps (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  otp_hash        TEXT NOT NULL,
  otp_salt        TEXT NOT NULL,
  purpose         TEXT NOT NULL CHECK (purpose IN (
                    'signup_verification',
                    'password_reset',
                    'email_change_old',
                    'email_change_new',
                    'login_verification'
                  )),
  expires_at      TIMESTAMPTZ NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  verified_at     TIMESTAMPTZ,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_otps_email_purpose
  ON public.auth_email_otps (lower(email), purpose);
CREATE INDEX IF NOT EXISTS idx_auth_otps_expires
  ON public.auth_email_otps (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_otps_user_id
  ON public.auth_email_otps (user_id);

ALTER TABLE public.auth_email_otps ENABLE ROW LEVEL SECURITY;

-- Only service role can manage OTP records
DROP POLICY IF EXISTS "Service role manages auth otps" ON public.auth_email_otps;
CREATE POLICY "Service role manages auth otps"
  ON public.auth_email_otps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public/authenticated users CANNOT directly read OTP hashes
DROP POLICY IF EXISTS "No public access to auth otps" ON public.auth_email_otps;
CREATE POLICY "No public access to auth otps"
  ON public.auth_email_otps
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);


-- TABLE B: email_notifications
-- Records every email sent through the system
CREATE TABLE IF NOT EXISTS public.email_notifications (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email   TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  subject           TEXT NOT NULL,
  delivery_status   TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN (
                      'pending', 'sent', 'failed', 'simulated'
                    )),
  provider          TEXT NOT NULL DEFAULT 'emailjs',
  provider_response JSONB,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_user_id
  ON public.email_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_email
  ON public.email_notifications (lower(recipient_email));
CREATE INDEX IF NOT EXISTS idx_email_notifications_event_type
  ON public.email_notifications (event_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_created
  ON public.email_notifications (created_at DESC);

ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages email notifications" ON public.email_notifications;
CREATE POLICY "Service role manages email notifications"
  ON public.email_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can view their own notifications
DROP POLICY IF EXISTS "Users can view own email notifications" ON public.email_notifications;
CREATE POLICY "Users can view own email notifications"
  ON public.email_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- TABLE C: account_security_logs
-- Audit log for security-related account events
CREATE TABLE IF NOT EXISTS public.account_security_logs (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  description      TEXT NOT NULL,
  ip_address_hash  TEXT,
  device_info      TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_logs_user_id
  ON public.account_security_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type
  ON public.account_security_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created
  ON public.account_security_logs (created_at DESC);

ALTER TABLE public.account_security_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages security logs" ON public.account_security_logs;
CREATE POLICY "Service role manages security logs"
  ON public.account_security_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own security logs (read-only, never editable)
DROP POLICY IF EXISTS "Users can view own security logs" ON public.account_security_logs;
CREATE POLICY "Users can view own security logs"
  ON public.account_security_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- TABLE D: pending_email_changes
-- Tracks two-step email change verifications
CREATE TABLE IF NOT EXISTS public.pending_email_changes (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_email               TEXT NOT NULL,
  new_email               TEXT NOT NULL,
  old_email_verified_at   TIMESTAMPTZ,
  new_email_verified_at   TIMESTAMPTZ,
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'old_verified', 'new_verified', 'completed', 'expired', 'cancelled'
                          )),
  expires_at              TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at            TIMESTAMPTZ
);

-- Partial unique index ensures at most ONE active pending request per user at any time,
-- while allowing unlimited historical completed, expired, or cancelled records.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_pending_email_change
  ON public.pending_email_changes (user_id)
  WHERE status IN ('pending', 'old_verified');

CREATE INDEX IF NOT EXISTS idx_pending_email_changes_user_id
  ON public.pending_email_changes (user_id);
CREATE INDEX IF NOT EXISTS idx_pending_email_changes_new_email
  ON public.pending_email_changes (lower(new_email));
CREATE INDEX IF NOT EXISTS idx_pending_email_changes_expires
  ON public.pending_email_changes (expires_at);

ALTER TABLE public.pending_email_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages pending email changes" ON public.pending_email_changes;
CREATE POLICY "Service role manages pending email changes"
  ON public.pending_email_changes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own pending email changes
DROP POLICY IF EXISTS "Users can view own pending email changes" ON public.pending_email_changes;
CREATE POLICY "Users can view own pending email changes"
  ON public.pending_email_changes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
