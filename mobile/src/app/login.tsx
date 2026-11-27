import { useState } from 'react';
import { router } from 'expo-router';
import {
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldAlert,
  UserPlus,
} from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Field, Notice, Page } from '@/components/security-ui';
import { loginGuard } from '@/services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [statusType, setStatusType] = useState<
    'PENDING' | 'REJECTED' | 'SUSPENDED' | 'AUTH_ERROR' | null
  >(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid work email address.');
      setStatusType('AUTH_ERROR');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setStatusType('AUTH_ERROR');
      return;
    }

    setError('');
    setStatusType(null);
    setLoading(true);
    try {
      const result = await loginGuard(email, password);
      if (result.success) {
        router.replace('/dashboard');
      } else {
        setError(result.error || 'Authentication failed. Please verify credentials.');
        setStatusType(result.statusType || 'AUTH_ERROR');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Server connection failed. Ensure backend is running.',
      );
      setStatusType('AUTH_ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title="Guard Sign In" subtitle="Campus Security Portal">
      <View style={styles.mark}>
        <Image
          source={require('../assets/images/security-logo.png')}
          style={styles.logo}
          resizeMode="contain"
          alt="Security Guard Seal"
        />
        <AppText style={styles.brand}>Duty Officer Sign In</AppText>
        <AppText style={styles.muted}>Dev Sanskriti Vishwavidyalaya · Security Portal</AppText>
      </View>

      {/* Special Status Notices */}
      {statusType === 'PENDING' && (
        <Card style={styles.statusNoticePending}>
          <View style={styles.statusHeaderRow}>
            <Clock size={24} color="#B45309" />
            <AppText style={styles.statusNoticeTitlePending}>
              Account Pending Approval
            </AppText>
          </View>
          <AppText style={styles.statusNoticeBodyPending}>
            Your guard registration request has been submitted successfully. Your account is currently awaiting Admin approval. You will be able to access the Guard Dashboard after your request is approved.
          </AppText>
          <AppText style={styles.statusNoticeContact}>
            For urgent gate duties, contact Security Control: <AppText style={styles.bold}>security@dsvv.ac.in</AppText>
          </AppText>
        </Card>
      )}

      {statusType === 'REJECTED' && (
        <Card style={styles.statusNoticeRejected}>
          <View style={styles.statusHeaderRow}>
            <AlertTriangle size={24} color="#B91C1C" />
            <AppText style={styles.statusNoticeTitleRejected}>
              Registration Not Approved
            </AppText>
          </View>
          <AppText style={styles.statusNoticeBodyRejected}>
            {error || 'Your registration request was not approved by the administrator.'}
          </AppText>
          <AppText style={styles.statusNoticeContact}>
            Please contact the administration office or re-apply: <AppText style={styles.bold}>security@dsvv.ac.in</AppText>
          </AppText>
        </Card>
      )}

      {statusType === 'SUSPENDED' && (
        <Card style={styles.statusNoticeRejected}>
          <View style={styles.statusHeaderRow}>
            <ShieldAlert size={24} color="#B91C1C" />
            <AppText style={styles.statusNoticeTitleRejected}>
              Account Suspended
            </AppText>
          </View>
          <AppText style={styles.statusNoticeBodyRejected}>
            Your guard credentials and gate duty permissions have been deactivated by the administrator.
          </AppText>
          <AppText style={styles.statusNoticeContact}>
            Report to Chief Security Officer: <AppText style={styles.bold}>security@dsvv.ac.in</AppText>
          </AppText>
        </Card>
      )}

      <Card style={styles.form}>
        <Field
          label="Work Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (statusType) setStatusType(null);
          }}
          placeholder="guard@campus.edu or name@dsvv.ac.in"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (statusType) setStatusType(null);
          }}
          placeholder="Enter your security password"
          secureTextEntry={!visible}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visible ? 'Hide password' : 'Show password'}
              onPress={() => setVisible(!visible)}
              hitSlop={10}
            >
              {visible ? <EyeOff size={19} color={colors.muted} /> : <Eye size={19} color={colors.muted} />}
            </Pressable>
          }
        />

        {error && statusType === 'AUTH_ERROR' ? (
          <AppText accessibilityRole="alert" style={styles.error}>
            {error}
          </AppText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/forgot-password')}
          style={styles.forgot}
        >
          <AppText style={styles.link}>Forgot password?</AppText>
        </Pressable>

        <Button
          label={loading ? 'Verifying Credentials...' : 'Sign In as Guard'}
          icon={LockKeyhole}
          onPress={() => void submit()}
        />

        {/* New Guard Registration Action */}
        <View style={styles.signupBox}>
          <AppText style={styles.signupPrompt}>New campus security guard?</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/register' as any)}
            style={styles.signupButton}
          >
            <UserPlus size={16} color={colors.blue} />
            <AppText style={styles.signupLink}>Register New Guard Account</AppText>
          </Pressable>
        </View>

        <Notice>Security Gate System: Authorized security personnel and gate operators only. Session is preserved across app restarts.</Notice>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', gap: 7, paddingVertical: 15 },
  logo: { width: 72, height: 72, marginBottom: 4 },
  brand: { fontSize: 22, fontWeight: '800', color: colors.ink },
  muted: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  form: { gap: 16 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 2 },
  link: { color: colors.blue, fontSize: 13, fontWeight: '700' },
  error: { color: colors.red, fontSize: 12 },
  signupBox: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signupPrompt: { fontSize: 13, color: colors.muted },
  signupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  signupLink: { color: colors.blue, fontSize: 14, fontWeight: '800' },
  statusNoticePending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusNoticeTitlePending: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  statusNoticeBodyPending: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  statusNoticeRejected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  statusNoticeTitleRejected: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
  },
  statusNoticeBodyRejected: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  statusNoticeContact: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  bold: { fontWeight: '700', color: colors.ink },
});
