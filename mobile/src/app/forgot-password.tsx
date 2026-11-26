import { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { CheckCircle2, KeyRound, Lock, MailCheck, Shield } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Field, Notice, Page } from '@/components/security-ui';
import {
  requestPasswordReset,
  verifyPasswordResetOtp,
  completePasswordReset,
} from '@/services/api';

type Step = 'email' | 'otp' | 'password' | 'done';

const COOLDOWN_SECONDS = 60;
const EXPIRY_SECONDS = 300; // 5 minutes

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [recoveryToken, setRecoveryToken] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const [expiry, setExpiry] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimers = () => {
    setCooldown(COOLDOWN_SECONDS);
    setExpiry(EXPIRY_SECONDS);

    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (expiryRef.current) clearInterval(expiryRef.current);
    expiryRef.current = setInterval(() => {
      setExpiry((prev) => {
        if (prev <= 1) {
          if (expiryRef.current) clearInterval(expiryRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (expiryRef.current) clearInterval(expiryRef.current);
    };
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Step 1: Request OTP ──
  const handleEmailSubmit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid work email address to continue.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      if (res.ok) {
        startTimers();
        setStep('otp');
        setMessage(res.message || 'Verification code sent to your registered email.');
      } else {
        setError(res.error || 'Failed to request password reset. Please try again.');
      }
    } catch {
      setError('Network failure while submitting request. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ──
  const handleOtpSubmit = async () => {
    const cleanOtp = otp.trim().replace(/\D/g, '');
    if (cleanOtp.length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await verifyPasswordResetOtp(email.trim().toLowerCase(), cleanOtp);
      if (res.ok) {
        setRecoveryToken(res.recoveryToken);
        setStep('password');
        setMessage('Code verified! Please enter your new password.');
      } else {
        setError(res.error || 'Invalid or expired verification code.');
      }
    } catch {
      setError('Network failure while verifying code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      if (res.ok) {
        startTimers();
        setMessage('A new verification code has been sent.');
      } else {
        setError(res.error || 'Failed to resend code.');
      }
    } catch {
      setError('Network failure while resending code.');
    }
  };

  // ── Step 3: Set New Password ──
  const handlePasswordSubmit = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await completePasswordReset(password, email.trim().toLowerCase(), otp.trim(), recoveryToken);
      if (res.ok) {
        setStep('done');
      } else {
        setError(res.error || 'Failed to update password.');
      }
    } catch {
      setError('Network failure while updating password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title="Forgot Password" subtitle="Guard Account Support">
      {/* ── STEP 1: Email ── */}
      {step === 'email' && (
        <>
          <View style={styles.intro}>
            <View style={styles.icon}>
              <MailCheck color={colors.blue} size={24} />
            </View>
            <AppText style={styles.title}>Reset Your Password</AppText>
            <AppText style={styles.copy}>
              Enter your registered university email to receive a 6-digit verification code.
            </AppText>
          </View>
          <Card style={styles.card}>
            <Field
              label="Registered Work Email"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder="officer@dsvv.edu.in"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
            {message ? <Notice tone="green">{message}</Notice> : null}
            <Button
              label={loading ? 'Sending Code...' : 'Send Verification Code'}
              onPress={handleEmailSubmit}
              disabled={loading}
            />
          </Card>
        </>
      )}

      {/* ── STEP 2: OTP ── */}
      {step === 'otp' && (
        <>
          <View style={styles.intro}>
            <View style={styles.icon}>
              <Shield color={colors.blue} size={24} />
            </View>
            <AppText style={styles.title}>Enter 6-Digit Code</AppText>
            <AppText style={styles.copy}>
              Verification code sent to {maskEmail(email)}.
            </AppText>
            <AppText style={styles.timer}>Expires in: {formatTimer(expiry)}</AppText>
          </View>
          <Card style={styles.card}>
            <Field
              label="Verification Code (OTP)"
              value={otp}
              onChangeText={(t) => { setOtp(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
            />
            {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
            {message ? <Notice tone="green">{message}</Notice> : null}
            <Button
              label={loading ? 'Verifying...' : 'Verify Code'}
              onPress={handleOtpSubmit}
              disabled={loading || otp.length < 6 || expiry <= 0}
            />
            <Button
              label={cooldown > 0 ? `Resend Code in ${cooldown}s` : 'Resend Code'}
              variant="outline"
              onPress={handleResend}
              disabled={cooldown > 0}
            />
          </Card>
        </>
      )}

      {/* ── STEP 3: Password ── */}
      {step === 'password' && (
        <>
          <View style={styles.intro}>
            <View style={styles.icon}>
              <Lock color={colors.blue} size={24} />
            </View>
            <AppText style={styles.title}>Set New Password</AppText>
            <AppText style={styles.copy}>
              Minimum 8 characters with at least one letter and one number.
            </AppText>
          </View>
          <Card style={styles.card}>
            <Field
              label="New Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              placeholder="Enter new password"
              secureTextEntry
            />
            <Field
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
              placeholder="Re-enter new password"
              secureTextEntry
            />
            {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
            <Button
              label={loading ? 'Updating Password...' : 'Update Password'}
              onPress={handlePasswordSubmit}
              disabled={loading}
            />
          </Card>
        </>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 'done' && (
        <Card style={styles.doneCard}>
          <View style={styles.successIcon}>
            <CheckCircle2 color={colors.green} size={40} />
          </View>
          <AppText style={styles.doneTitle}>Password Updated!</AppText>
          <AppText style={styles.doneCopy}>
            Your security guard account password has been changed successfully. You can now sign in with your new credentials.
          </AppText>
          <Button
            label="Sign In Now"
            onPress={() => router.replace('/login')}
          />
        </Card>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  title: { color: colors.ink, fontWeight: '800', fontSize: 20 },
  copy: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 320 },
  timer: { color: colors.blue, fontSize: 12, fontWeight: '700', marginTop: 2 },
  card: { gap: 14 },
  error: { color: colors.red, fontSize: 12 },
  doneCard: { alignItems: 'center', padding: 24, gap: 14, marginTop: 20 },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { color: colors.ink, fontWeight: '800', fontSize: 19, textAlign: 'center' },
  doneCopy: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
