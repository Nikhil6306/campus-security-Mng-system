import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  LogOut,
  Shield,
  ShieldCheck,
  UserRound,
  Volume2,
  type LucideIcon,
} from 'lucide-react-native';
import { Switch, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Notice, Page } from '@/components/security-ui';
import { getGuardSession, logoutGuard, type GuardSession } from '@/services/api';

export default function ProfileScreen() {
  const [session, setSession] = useState<GuardSession | null>(getGuardSession());
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    setSession(getGuardSession());
  }, []);

  const handleLogout = async () => {
    await logoutGuard();
    router.replace('/login');
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
  icon: LucideIcon;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.settingIcon}>
        <Icon size={18} color={colors.blue} />
      </View>
      <AppText style={styles.settingLabel}>{label}</AppText>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#D5DCE6', true: '#9BBFFF' }}
        thumbColor={value ? colors.blue : '#FFFFFF'}
      />
    </View>
  );
}

function MenuRow({
  icon: Icon,
  label,
  caption,
}: {
  icon: LucideIcon;
  label: string;
  caption: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.settingIcon}>
        <Icon size={18} color={colors.blue} />
      </View>
      <View style={styles.menuCopy}>
        <AppText style={styles.settingLabel}>{label}</AppText>
        <AppText style={styles.caption}>{caption}</AppText>
      </View>
      <ChevronRight size={17} color={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink },
  email: { color: colors.muted, fontSize: 13 },
  duty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.greenSoft,
    marginTop: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.green },
  dutyText: { color: colors.green, fontSize: 11, fontWeight: '700' },
  section: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 6,
  },
  settings: { paddingVertical: 4, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: 12 },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { color: colors.ink, fontSize: 13, fontWeight: '700', flex: 1 },
  menuCopy: { flex: 1, gap: 2 },
  caption: { color: colors.muted, fontSize: 11 },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 48 },
  version: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
