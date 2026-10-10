import { useState } from 'react';
import { router } from 'expo-router';
import { Bell, ChevronRight, CircleHelp, LogOut, Shield, UserRound, Volume2, type LucideIcon } from 'lucide-react-native';
import { Switch, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Notice, Page } from '@/components/security-ui';

export default function ProfileScreen() {
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(false);
  return (
    <Page title="Guard profile" subtitle="Profile & preferences" bottomNav>
      <Card style={styles.identity}>
        <View style={styles.avatar}><UserRound size={27} color={colors.blue} /></View>
        <AppText style={styles.name}>Campus Guard</AppText>
        <AppText style={styles.email}>guard@campus.edu · Demo profile</AppText>
        <View style={styles.duty}><View style={styles.dot} /><AppText style={styles.dutyText}>On duty · Main Gate</AppText></View>
      </Card>
      <Notice>Profile and preference changes stay on this screen and are not saved to an account.</Notice>
      <AppText style={styles.section}>PREFERENCES</AppText>
      <Card style={styles.settings}>
        <Preference icon={Bell} label="Notifications" value={notifications} onChange={setNotifications} />
        <View style={styles.divider} />
        <Preference icon={Volume2} label="Sound alerts" value={sound} onChange={setSound} />
      </Card>
      <AppText style={styles.section}>SUPPORT</AppText>
      <Card style={styles.settings}>
        <MenuRow icon={Shield} label="Privacy & demo mode" caption="No live account or campus connection" />
        <View style={styles.divider} />
        <MenuRow icon={CircleHelp} label="Help & guidelines" caption="Contact your campus administrator" />
      </Card>
      <Button label="Sign out of demo" icon={LogOut} variant="outline" onPress={() => router.replace('/')} />
      <AppText style={styles.version}>CAMPUS SECURITY MOBILE · FRONTEND DEMO</AppText>
    </Page>
  );
}

function Preference({ icon: Icon, label, value, onChange }: { icon: LucideIcon; label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.row}><View style={styles.settingIcon}><Icon size={17} color={colors.blue} /></View><AppText style={styles.settingLabel}>{label}</AppText><Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ false: '#D5DCE6', true: '#9BBFFF' }} thumbColor={value ? colors.blue : '#FFFFFF'} /></View>;
}

function MenuRow({ icon: Icon, label, caption }: { icon: LucideIcon; label: string; caption: string }) {
  return <View style={styles.row}><View style={styles.settingIcon}><Icon size={17} color={colors.blue} /></View><View style={styles.menuCopy}><AppText style={styles.settingLabel}>{label}</AppText><AppText style={styles.caption}>{caption}</AppText></View><ChevronRight size={17} color={colors.muted} /></View>;
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', paddingVertical: 23, gap: 8 },
  avatar: { width: 62, height: 62, borderRadius: 22, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 19, fontWeight: '800' },
  email: { color: colors.muted, fontSize: 12 },
  duty: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 15, backgroundColor: colors.greenSoft, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  dutyText: { color: colors.green, fontSize: 10, fontWeight: '700' },
  section: { fontSize: 10, color: colors.muted, fontWeight: '800', letterSpacing: 1.2, marginTop: 4 },
  settings: { paddingVertical: 4, paddingHorizontal: 13 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 58, gap: 10 },
  settingIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { color: colors.ink, fontSize: 12, fontWeight: '700', flex: 1 },
  menuCopy: { flex: 1, gap: 3 },
  caption: { color: colors.muted, fontSize: 10 },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 43 },
  version: { color: colors.muted, fontSize: 9, letterSpacing: 1, textAlign: 'center', paddingVertical: 4 },
});
