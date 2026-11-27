import { useState } from 'react';
import { router } from 'expo-router';
import {
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
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

export default function RegisterScreen() {
  // ONLY 4 registration fields per master prompt specifications:
  // 1. Full Name
  // 2. Mobile Number
  // 3. Email Address
  // 4. Password
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [pwdVisible, setPwdVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    requestId: string;
    fullName: string;
    email: string;
    message: string;
  } | null>(null);

  const submit = async () => {
    setError('');

    // 1. Full Name validation
    if (!fullName.trim() || fullName.trim().length < 3) {
      setError('Please enter your full name (at least 3 characters).');
      return;
    }

    // 2. Mobile Number validation (Indian 10-digit number)
    const rawDigits = phone.replace(/[^0-9]/g, '');
    const cleanDigits = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
    if (!cleanDigits || !/^[6-9]\d{9}$/.test(cleanDigits)) {
      setError('Please enter a valid 10-digit Indian mobile number (+91 optional).');
      return;
    }

    // 3. Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    // 4. Password validation (secure password policy)
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerGuard({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanDigits,
        password,
      });

      if (res.success) {
        setSubmittedData({
          requestId: res.data?.requestId || res.data?.id || 'REQ-GRD',
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          message:
            res.message ||
            'Your guard registration request has been submitted successfully. Your account is currently awaiting Admin approval. You will be able to access the Guard Dashboard after your request is approved.',
        });
      } else {
        setError(res.message || 'Registration failed. Please check inputs and try again.');
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

  // ------------------------------------------------------------------------
  // POST-SUBMISSION: PENDING ADMIN APPROVAL STATE
  // ------------------------------------------------------------------------
  if (submittedData) {
    return (
      <Page title="Registration Submitted" subtitle="Dev Sanskriti Vishwavidyalaya">
        <View style={styles.submittedContainer}>
          <Card style={styles.successCard}>
            <View style={styles.successIconWrapper}>
              <Clock size={44} color={colors.amber} />
            </View>

            <AppText style={styles.successTitle}>
              Registration Request Submitted
            </AppText>

            <View style={styles.badgePending}>
              <AppText style={styles.badgePendingText}>PENDING – Awaiting Admin Approval</AppText>
            </View>

            <View style={styles.detailsBox}>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Reference ID:</AppText>
                <AppText style={styles.detailValuePrimary}>{submittedData.requestId}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Applicant Name:</AppText>
                <AppText style={styles.detailValue}>{submittedData.fullName}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Registered Email:</AppText>
                <AppText style={styles.detailValue}>{submittedData.email}</AppText>
              </View>
            </View>

            {/* Exact required status message */}
            <Notice tone="amber">
              {submittedData.message}
            </Notice>

            <View style={{ marginTop: 22 }}>
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

  // ------------------------------------------------------------------------
  // NEW GUARD REGISTRATION FORM: EXACTLY 4 FIELDS
  // ------------------------------------------------------------------------
  return (
    <Page title="Guard Registration" subtitle="Dev Sanskriti Vishwavidyalaya">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.mark}>
          <Image
            source={require('../assets/images/security-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            alt="Security Guard Seal"
          />
          <AppText style={styles.brand}>Register New Guard</AppText>
          <AppText style={styles.muted}>
            Campus Security Management System · Haridwar
          </AppText>
        </View>

        <Card style={styles.form}>
          <Notice>
            Authorized Security Personnel Onboarding: Submit your details for administrative review and gate assignment.
          </Notice>

          {error ? (
            <Notice tone="red">
              {error}
            </Notice>
          ) : null}

          {/* 1. Full Name */}
          <Field
            label="1. Full Name *"
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              if (error) setError('');
            }}
            placeholder="e.g. Ramesh Chandra Sharma"
            autoCapitalize="words"
          />

          {/* 2. Mobile Number (Indian format) */}
          <Field
            label="2. Mobile Number (10 digits) *"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (error) setError('');
            }}
            placeholder="9876543210 (+91 optional)"
            keyboardType="phone-pad"
            maxLength={13}
          />

          {/* 3. Email Address */}
          <Field
            label="3. Email Address *"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError('');
            }}
            placeholder="guard.ramesh@dsvv.ac.in"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* 4. Password */}
          <Field
            label="4. Password (min 6 characters) *"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (error) setError('');
            }}
            placeholder="Enter secure password"
            secureTextEntry={!pwdVisible}
            right={
              <Pressable
                accessibilityRole="button"
                onPress={() => setPwdVisible(!pwdVisible)}
                hitSlop={10}
              >
                {pwdVisible ? (
                  <EyeOff size={18} color={colors.muted} />
                ) : (
                  <Eye size={18} color={colors.muted} />
                )}
              </Pressable>
            }
          />

          <View style={{ marginTop: 12 }}>
            <Button
              label={loading ? 'Submitting Registration...' : 'Submit Guard Registration'}
              onPress={() => void submit()}
              disabled={loading}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/login')}
            style={styles.backButton}
          >
            <AppText style={styles.backButtonText}>
              Already registered? Sign In as Guard
            </AppText>
          </Pressable>
        </Card>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  mark: {
    alignItems: 'center',
    marginBottom: 18,
    gap: 4,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  brand: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  muted: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  form: {
    gap: 14,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  backButtonText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '600',
  },
  submittedContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCard: {
    width: '100%',
    padding: 22,
    alignItems: 'center',
    gap: 14,
  },
  successIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  badgePending: {
    backgroundColor: colors.amberSoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgePendingText: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  detailValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  detailValuePrimary: {
    color: colors.blue,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
});
