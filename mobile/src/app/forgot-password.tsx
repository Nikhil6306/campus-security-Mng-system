import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, Card, colors, Field, Notice, Page } from '@/components/security-ui';
import {
  requestPasswordReset,
  resendPasswordResetOtp,
  resetPasswordWithToken,
  verifyPasswordResetOtp,
} from '@/services/api';

type Step = 'email' | 'otp' | 'password' | 'success';

const OTP_EXPIRY_SECONDS = 5 * 60;
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const [expiryRemaining, setExpiryRemaining] = useState(OTP_EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (step !== 'otp') return;
    const timer = setInterval(() => {
      setExpiryRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid registered email address.');
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await requestPasswordReset(cleanEmail);
      if (res.ok) {
        setEmail(cleanEmail);
        setOtp('');
        setExpiryRemaining(OTP_EXPIRY_SECONDS);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setInfo(res.message || 'We have sent a 6-digit verification code to your registered email address.');
        setStep('otp');
      } else {
        setError(res.error || 'Could not send verification OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await resendPasswordResetOtp(email);
      if (res.ok) {
        setOtp('');
        setExpiryRemaining(OTP_EXPIRY_SECONDS);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setInfo(res.message || 'A new 6-digit OTP has been sent. Previous OTP is now invalid.');
      } else {
        setError(res.error || 'Could not resend OTP.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = otp.replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await verifyPasswordResetOtp(email, cleanOtp);
      if (res.ok && res.recoveryToken) {
        setRecoveryToken(res.recoveryToken);
        setStep('password');
      } else {
        setError(res.error || 'Invalid or expired verification code.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must contain both letters and numbers.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Confirm password does not match new password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await resetPasswordWithToken(recoveryToken, newPassword);
      if (res.ok) {
        setStep('success');
      } else {
        setError(res.error || 'Could not update password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <Page title="Password Updated" subtitle="DSVV Campus Security">
        <Card style={styles.successCard}>
          <View style={styles.successIcon}>
            <CheckCircle2 color={colors.green} size={42} />
          </View>
          <AppText style={styles.title}>Password Updated</AppText>
          <Notice tone="green">
            Your password has been updated successfully. You can now sign in using your new password.
          </Notice>
          <View style={styles.fullWidth}>
            <Button
              label="Back to Sign In"
              icon={LockKeyhole}
              onPress={() => router.replace('/login')}
            />
          </View>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Forgot Password" subtitle="Guard Account Recovery">
      <View style={styles.intro}>
        <View style={styles.icon}>
          {step === 'email' ? (
            <MailCheck color={colors.blue} size={24} />
          ) : step === 'otp' ? (
            <ShieldCheck color={colors.blue} size={24} />
          ) : (
            <KeyRound color={colors.blue} size={24} />
          )}
        </View>
        <AppText style={styles.title}>
          {step === 'email'
            ? 'Forgot Password?'
            : step === 'otp'
              ? 'Verify Your Email'
              : 'Set New Password'}
        </AppText>
        <AppText style={styles.copy}>
          {step === 'email'
            ? 'Enter your registered email address. We will send you a verification OTP to reset your password.'
            : step === 'otp'
              ? `We have sent a 6-digit verification code to ${email}.`
              : 'Create a strong new password for your Guard account.'}
        </AppText>
      </View>

      {step === 'email' && (
        <Card style={styles.card}>
          <Field
            label="Registered Email Address"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) setError('');
            }}
            placeholder="guard@dsvv.ac.in"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {error ? <Notice tone="red">{error}</Notice> : null}
          <Button
            label={loading ? 'Sending OTP...' : 'Send OTP'}
            onPress={() => void handleSendOtp()}
            disabled={loading}
          />
        </Card>
      )}

      {step === 'otp' && (
        <Card style={styles.card}>
          {info ? <Notice>{info}</Notice> : null}

          <View style={styles.otpSection}>
            <AppText style={styles.otpLabel}>6-Digit Verification Code</AppText>
            <TextInput
              value={otp}
              onChangeText={(v) => {
                setOtp(v.replace(/\D/g, '').slice(0, 6));
                if (error) setError('');
              }}
              placeholder="000000"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              maxLength={6}
              style={styles.otpInput}
              autoFocus
            />
            <View style={styles.timerRow}>
              <AppText style={styles.timerText}>
                {expiryRemaining > 0
                  ? `Expires in ${formatTimer(expiryRemaining)}`
                  : 'OTP expired — please resend'}
              </AppText>
            </View>
          </View>

          {error ? <Notice tone="red">{error}</Notice> : null}

          <Button
            label={loading ? 'Verifying OTP...' : 'Verify OTP'}
            onPress={() => void handleVerifyOtp()}
            disabled={loading || otp.replace(/\D/g, '').length !== 6}
          />

          <Pressable
            accessibilityRole="button"
            disabled={resendCooldown > 0 || loading}
            onPress={() => void handleResendOtp()}
            style={[styles.resendBtn, (resendCooldown > 0 || loading) && { opacity: 0.5 }]}
          >
            <RefreshCw size={15} color={colors.blue} />
            <AppText style={styles.resendText}>
              {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
            </AppText>
          </Pressable>
        </Card>
      )}

      {step === 'password' && (
        <Card style={styles.card}>
          <Notice>
            Password requirements: Minimum 8 characters, including at least one letter and one number.
          </Notice>

          <Field
            label="New Password"
            value={newPassword}
            onChangeText={(v) => {
              setNewPassword(v);
              if (error) setError('');
            }}
            placeholder="Minimum 8 characters"
            secureTextEntry={!showNewPwd}
            right={
              <Pressable accessibilityRole="button" onPress={() => setShowNewPwd(!showNewPwd)} hitSlop={10}>
                {showNewPwd ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
              </Pressable>
            }
          />

          <Field
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v);
              if (error) setError('');
            }}
            placeholder="Re-enter new password"
            secureTextEntry={!showConfirmPwd}
            right={
              <Pressable accessibilityRole="button" onPress={() => setShowConfirmPwd(!showConfirmPwd)} hitSlop={10}>
                {showConfirmPwd ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
              </Pressable>
            }
          />

          {error ? <Notice tone="red">{error}</Notice> : null}

          <Button
            label={loading ? 'Updating Password...' : 'Update Password'}
            onPress={() => void handleUpdatePassword()}
            disabled={loading}
          />
        </Card>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  title: { color: colors.ink, fontWeight: '800', fontSize: 21, textAlign: 'center' },
  copy: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  card: { gap: 15 },
  otpSection: { gap: 8 },
  otpLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  otpInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
    color: colors.ink,
    fontFamily: 'monospace',
  },
  timerRow: { alignItems: 'flex-end' },
  timerText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  resendText: { color: colors.blue, fontSize: 13, fontWeight: '700' },
  successCard: { gap: 16, alignItems: 'center', paddingVertical: 22 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
});
