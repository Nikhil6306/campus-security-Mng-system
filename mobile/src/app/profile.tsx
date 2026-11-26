import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  LogOut,
  Mail,
  Shield,
  ShieldCheck,
  UserRound,
  Volume2,
  type LucideIcon,
} from 'lucide-react-native';
import { Switch, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Field, Notice, Page } from '@/components/security-ui';
import {
  getGuardSession,
  logoutGuard,
  requestMobileEmailChange,
  verifyMobileOldEmailOtp,
  verifyMobileNewEmailOtp,
  type GuardSession,
} from '@/services/api';

export default function ProfileScreen() {
  const [session, setSession] = useState<GuardSession | null>(getGuardSession());
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);

  // Change Email State
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [emailStep, setEmailStep] = useState<'input' | 'verify_old' | 'verify_new' | 'done'>('input');
  const [newEmail, setNewEmail] = useState('');
  const [oldEmailOtp, setOldEmailOtp] = useState('');
  const [newEmailOtp, setNewEmailOtp] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  useEffect(() => {
    setSession(getGuardSession());
  }, []);

  const handleLogout = async () => {
    await logoutGuard();
    router.replace('/login');
  };

  const handleRequestEmailChange = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      setEmailError('Please enter a valid new email address.');
      return;
    }
    setEmailError('');
    setEmailLoading(true);
    try {
      const res = await requestMobileEmailChange(newEmail.trim().toLowerCase());
      if (res.ok) {
        setEmailStep('verify_old');
        setEmailMessage(res.message || 'Verification code sent to current email.');
      } else {
        setEmailError(res.error || 'Failed to request email change.');
      }
    } catch {
      setEmailError('Network failure while requesting email change.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyOldEmail = async () => {
    setEmailError('');
    setEmailLoading(true);
    try {
      const res = await verifyMobileOldEmailOtp(oldEmailOtp.trim());
      if (res.ok) {
        setEmailStep('verify_new');
        setEmailMessage('Current email verified! Code sent to new email.');
      } else {
        setEmailError(res.error || 'Invalid verification code.');
      }
    } catch {
      setEmailError('Network failure while verifying code.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyNewEmail = async () => {
    setEmailError('');
    setEmailLoading(true);
    try {
      const res = await verifyMobileNewEmailOtp(newEmailOtp.trim());
      if (res.ok) {
        setEmailStep('done');
        if (session) {
          setSession({ ...session, email: res.updatedEmail || newEmail });
        }
      } else {
        setEmailError(res.error || 'Invalid verification code.');
      }
    } catch {
      setEmailError('Network failure while updating email.');
    } finally {
      setEmailLoading(false);
    }
  };

  const guardName = session?.name || 'Security Officer';
  const guardEmail = session?.email || 'security@dsvv.edu.in';
  const guardRole = session?.role?.toUpperCase() || 'SECURITY';
  const gateName = session?.gate || 'Main Gate';

  return (
    <Page title="Guard Profile" subtitle="Officer Credentials & Settings" bottomNav>
      <Card style={styles.identity}>
        <View style={styles.avatar}>
          <UserRound size={32} color={colors.blue} />
        </View>
        <AppText style={styles.name}>{guardName}</AppText>
        <AppText style={styles.email}>{guardEmail}</AppText>
        <View style={styles.duty}>
          <View style={styles.dot} />
          <AppText style={styles.dutyText}>On Duty · {gateName} · {guardRole}</AppText>
        </View>
      </Card>

      <AppText style={styles.section}>ACCOUNT SECURITY</AppText>
      <Card style={styles.settings}>
        {!showChangeEmail ? (
          <Button
            label="Change Registered Work Email"
            icon={Mail}
            variant="outline"
            onPress={() => setShowChangeEmail(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            <AppText style={{ fontWeight: '700', fontSize: 15, color: colors.ink }}>
              Change Registered Email
            </AppText>
            {emailStep === 'input' && (
              <>
                <Field
                  label="New Work Email"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="new.officer@dsvv.edu.in"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {emailError ? <Notice tone="red">{emailError}</Notice> : null}
                {emailMessage ? <Notice tone="green">{emailMessage}</Notice> : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button
                    label="Cancel"
                    variant="outline"
                    onPress={() => { setShowChangeEmail(false); setEmailError(''); setEmailMessage(''); }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={emailLoading ? 'Sending...' : 'Send OTP'}
                    onPress={handleRequestEmailChange}
                    disabled={emailLoading || !newEmail}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}
            {emailStep === 'verify_old' && (
              <>
                <Notice tone="blue">
                  Enter 6-digit code sent to your CURRENT email ({guardEmail}).
                </Notice>
                <Field
                  label="Current Email OTP"
                  value={oldEmailOtp}
                  onChangeText={(t) => setOldEmailOtp(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {emailError ? <Notice tone="red">{emailError}</Notice> : null}
                <Button
                  label={emailLoading ? 'Verifying...' : 'Verify Current Email'}
                  onPress={handleVerifyOldEmail}
                  disabled={emailLoading || oldEmailOtp.length < 6}
                />
              </>
            )}
            {emailStep === 'verify_new' && (
              <>
                <Notice tone="blue">
                  Enter 6-digit code sent to your NEW email ({newEmail}).
                </Notice>
                <Field
                  label="New Email OTP"
                  value={newEmailOtp}
                  onChangeText={(t) => setNewEmailOtp(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {emailError ? <Notice tone="red">{emailError}</Notice> : null}
                <Button
                  label={emailLoading ? 'Confirming...' : 'Confirm & Update Email'}
                  onPress={handleVerifyNewEmail}
                  disabled={emailLoading || newEmailOtp.length < 6}
                />
              </>
            )}
            {emailStep === 'done' && (
              <>
                <Notice tone="green">
                  Email successfully updated to {newEmail}! Notifications sent.
                </Notice>
                <Button
                  label="Close"
                  variant="outline"
                  onPress={() => { setShowChangeEmail(false); setEmailStep('input'); }}
                />
              </>
            )}
          </View>
        )}
      </Card>

      <AppText style={styles.section}>DEVICE & ALERT PREFERENCES</AppText>
      <Card style={styles.settings}>
        <Preference
          icon={Bell}
          label="Push & SMS Notifications"
          value={notifications}
          onChange={setNotifications}
        />
        <View style={styles.divider} />
        <Preference
          icon={Volume2}
          label="Emergency Siren Alert Audio"
          value={sound}
          onChange={setSound}
        />
      </Card>

      <AppText style={styles.section}>SECURITY & POLICIES</AppText>
      <Card style={styles.settings}>
        <MenuRow
          icon={ShieldCheck}
          label="Campus Security Policy"
          caption="Dev Sanskriti Vishwavidyalaya Safety Norms"
        />
        <View style={styles.divider} />
        <MenuRow
          icon={CircleHelp}
          label="Security Control Room"
          caption="Direct line to Head of Security"
        />
      </Card>

      <Button
        label="Sign Out of Security Portal"
        icon={LogOut}
        variant="danger"
        onPress={() => void handleLogout()}
      />

      <AppText style={styles.version}>
        DSVV CAMPUS SECURITY SYSTEM · ANDROID GUARD APP v1.0
      </AppText>
    </Page>
  );
}

function Preference({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preference}>
      <View style={styles.preferenceLabel}>
        <Icon size={18} color={colors.ink} />
        <AppText style={styles.preferenceText}>{label}</AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.blue }}
        thumbColor={colors.white}
      />
    </View>
  );
}

function MenuRow({
  icon: Icon,
  label,
  caption,
}: {
  icon: any;
  label: string;
  caption: string;
}) {
  return (
    <View style={styles.menuRow}>
      <View style={styles.menuIcon}>
        <Icon size={18} color={colors.blue} />
      </View>
      <View style={styles.menuBody}>
        <AppText style={styles.menuLabel}>{label}</AppText>
        <AppText style={styles.menuCaption}>{caption}</AppText>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  email: {
    fontSize: 13,
    color: colors.muted,
  },
  duty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  dutyText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.green,
  },
  section: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: -4,
  },
  settings: {
    padding: 12,
  },
  preference: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  preferenceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  preferenceText: {
    fontSize: 14,
    color: colors.ink,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBody: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  menuCaption: {
    fontSize: 11,
    color: colors.muted,
  },
  version: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 16,
  },
});
