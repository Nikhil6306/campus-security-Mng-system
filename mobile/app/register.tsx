import { useState } from 'react';
import { router } from 'expo-router';
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  IdCard,
  Lock,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  UserCheck,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  AppText,
  Button,
  Card,
  colors,
  Field,
  Notice,
  Page,
} from '@/components/security-ui';
import { registerGuard } from '@/services/api';

const DESIGNATIONS = [
  'Security Guard',
  'Head Guard',
  'Gate Supervisor',
  'Patrol Officer',
  'Security Desk Officer',
];

const GATES = [
  'Main Gate',
  'Gate 1 (North)',
  'Gate 2 (South)',
  'Hostel Gate',
  'Admin Gate',
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [guardId, setGuardId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [designation, setDesignation] = useState('Security Guard');
  const [assignedGate, setAssignedGate] = useState('Main Gate');

  const [pwdVisible, setPwdVisible] = useState(false);
  const [confirmPwdVisible, setConfirmPwdVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!guardId.trim()) {
      setError('Enter your Guard ID or Employee ID.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerGuard({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        guardId: guardId.trim().toUpperCase(),
        password,
        designation,
        assignedGate,
      });

      if (res.success) {
        setSubmitted(true);
      } else {
        setError(res.message || 'Registration failed. Please check inputs.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to campus security server.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Page title="Registration Submitted" subtitle="Dev Sanskriti Vishwavidyalaya">
        <View style={styles.submittedContainer}>
          <Card style={styles.successCard}>
            <View style={styles.successIconWrapper}>
              <Clock size={48} color={colors.amber} />
            </View>

            <AppText style={styles.successTitle}>
              Registration Request Submitted
            </AppText>

            <AppText style={styles.successBody}>
              Your account has been recorded successfully and is waiting for
              <AppText style={styles.bold}> Administrator Approval</AppText>.
            </AppText>

            <View style={styles.detailsBox}>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Officer Name:</AppText>
                <AppText style={styles.detailValue}>{fullName}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Guard ID:</AppText>
                <AppText style={styles.detailValue}>{guardId.toUpperCase()}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Registered Email:</AppText>
                <AppText style={styles.detailValue}>{email.toLowerCase()}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Assigned Gate:</AppText>
                <AppText style={styles.detailValue}>{assignedGate}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Status:</AppText>
                <View style={styles.badgePending}>
                  <AppText style={styles.badgePendingText}>PENDING APPROVAL</AppText>
                </View>
              </View>
            </View>

            <Notice tone="amber">
              You will receive an activation email once an administrator approves your
              application. You may then sign in using your registered email and password.
            </Notice>

            <View style={{ marginTop: 20 }}>
              <Button
                label="Return to Sign In"
                onPress={() => router.replace('/login')}
              />
            </View>
          </Card>
        </View>
      </Page>
    );
  }

  return (
    <Page title="Guard Sign Up" subtitle="Campus Security Registration">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.mark}>
          <Image
            source={require('../assets/images/security-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            alt="Security Guard Seal"
          />
          <AppText style={styles.brand}>Duty Officer Registration</AppText>
          <AppText style={styles.muted}>
            Dev Sanskriti Vishwavidyalaya · Security Personnel Onboarding
          </AppText>
        </View>

        <Card style={styles.form}>
          <Field
            label="Full Name *"
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Ramesh Kumar"
          />

          <Field
            label="Official / Work Email *"
            value={email}
            onChangeText={setEmail}
            placeholder="guard@campus.edu or name@dsvv.ac.in"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Field
            label="Mobile Number (10 digits) *"
            value={phone}
            onChangeText={setPhone}
            placeholder="9876543210"
            keyboardType="phone-pad"
            maxLength={10}
          />

          <Field
            label="Guard ID / Employee ID *"
            value={guardId}
            onChangeText={setGuardId}
            placeholder="e.g. GRD-101 or EMP-5421"
            autoCapitalize="characters"
          />

          {/* Designation Selection */}
          <View style={styles.selectGroup}>
            <AppText style={styles.selectLabel}>Designation / Role</AppText>
            <View style={styles.chipRow}>
              {DESIGNATIONS.map((d) => (
                <Pressable
                  key={d}
                  style={[
                    styles.chip,
                    designation === d && styles.chipActive,
                  ]}
                  onPress={() => setDesignation(d)}
                >
                  <AppText
                    style={[
                      styles.chipText,
                      designation === d && styles.chipTextActive,
                    ]}
                  >
                    {d}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Assigned Gate Selection */}
          <View style={styles.selectGroup}>
            <AppText style={styles.selectLabel}>Assigned Gate / Post</AppText>
            <View style={styles.chipRow}>
              {GATES.map((g) => (
                <Pressable
                  key={g}
                  style={[
                    styles.chip,
                    assignedGate === g && styles.chipActive,
                  ]}
                  onPress={() => setAssignedGate(g)}
                >
                  <AppText
                    style={[
                      styles.chipText,
                      assignedGate === g && styles.chipTextActive,
                    ]}
                  >
                    {g}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>

          <Field
            label="Password (min 6 characters) *"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter secure password"
            secureTextEntry={!pwdVisible}
            right={
              <Pressable
                accessibilityRole="button"
                onPress={() => setPwdVisible(!pwdVisible)}
                hitSlop={10}
              >
                {pwdVisible ? (
                  <EyeOff size={19} color={colors.muted} />
                ) : (
                  <Eye size={19} color={colors.muted} />
                )}
              </Pressable>
            }
          />

          <Field
            label="Confirm Password *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            secureTextEntry={!confirmPwdVisible}
            right={
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmPwdVisible(!confirmPwdVisible)}
                hitSlop={10}
              >
                {confirmPwdVisible ? (
                  <EyeOff size={19} color={colors.muted} />
                ) : (
                  <Eye size={19} color={colors.muted} />
                )}
              </Pressable>
            }
          />

          {error ? (
            <Notice tone="red">{error}</Notice>
          ) : null}

          <Button
            label={loading ? 'Submitting Registration...' : 'Submit for Admin Approval'}
            icon={UserCheck}
            onPress={() => void submit()}
          />

          <View style={styles.signinPrompt}>
            <AppText style={styles.promptText}>Already registered as guard?</AppText>
            <Pressable onPress={() => router.replace('/login')}>
              <AppText style={styles.signinLink}>Sign In Here</AppText>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  mark: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  logo: { width: 68, height: 68, marginBottom: 4 },
  brand: { fontSize: 21, fontWeight: '800', color: colors.ink },
  muted: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  form: { gap: 14, marginTop: 4 },
  selectGroup: { gap: 6 },
  selectLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slateSoft,
  },
  chipActive: {
    backgroundColor: '#0A192F',
    borderColor: '#0A192F',
  },
  chipText: { fontSize: 12, color: colors.ink, fontWeight: '600' },
  chipTextActive: { color: colors.white, fontWeight: '700' },
  signinPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  promptText: { fontSize: 13, color: colors.muted },
  signinLink: { fontSize: 13, fontWeight: '800', color: colors.blue },
  submittedContainer: { paddingTop: 20 },
  successCard: { padding: 20, gap: 14 },
  successIconWrapper: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  bold: { fontWeight: '700', color: colors.ink },
  detailsBox: {
    backgroundColor: colors.slateSoft,
    borderRadius: 10,
    padding: 14,
    gap: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  detailValue: { fontSize: 13, color: colors.ink, fontWeight: '700' },
  badgePending: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePendingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
});
