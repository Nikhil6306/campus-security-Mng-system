import { router } from 'expo-router';
import { Bell, ChevronRight, ClipboardCheck, DoorOpen, QrCode, Siren, UserRoundPlus, UsersRound } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, IconBox, Notice, Page, Pill, SectionTitle } from '@/components/security-ui';
import { useDemoStore } from '@/state/demo-store';

const stats = [
  { label: 'Visitors today', value: '42', icon: UsersRound, color: colors.blue },
  { label: 'On campus now', value: '18', icon: DoorOpen, color: colors.green },
  { label: 'Check-ins', value: '24', icon: UserRoundPlus, color: colors.blue },
  { label: 'Check-outs', value: '24', icon: ClipboardCheck, color: colors.amber },
];

export default function DashboardScreen() {
  const { visitors } = useDemoStore();
  const recent = visitors.slice(0, 3);
  const addedToday = Math.max(0, visitors.length - 4);
  const currentInside = visitors.filter(visitor => visitor.status === 'inside').length;
  const currentCheckedOut = visitors.filter(visitor => visitor.status === 'checked out').length;
  const values: Record<string, number> = {
    'Visitors today': 42 + addedToday,
    'On campus now': Math.max(0, 18 + currentInside - 2),
    'Check-ins': 24 + addedToday,
    'Check-outs': 24 + currentCheckedOut - 2,
  };
  const actions = [
    { title: 'New check-in', caption: 'Register a visitor', icon: UserRoundPlus, route: '/check-in' },
    { title: 'Scan visitor QR', caption: 'Verify a pass', icon: QrCode, route: '/scan' },
    { title: 'Check-out', caption: 'Record an exit', icon: DoorOpen, route: '/check-out' },
    { title: 'Emergency', caption: 'View response options', icon: Siren, route: '/emergency' },
  ] as const;
  return (
    <Page title="Good morning, Guard" subtitle="Main Gate · On duty" back={false} bottomNav>
      <View style={styles.banner}>
        <View style={styles.bannerTop}><View><AppText style={styles.bannerSmall}>SATURDAY · DAY SHIFT</AppText><AppText style={styles.bannerTitle}>Campus is secure</AppText></View><View style={styles.live}><View style={styles.dot} /><AppText style={styles.liveText}>ON DUTY</AppText></View></View>
        <AppText style={styles.bannerHint}>Your gate activity at a glance</AppText>
      </View>
      <Notice>Demo data · actions stay on this device and do not update campus systems.</Notice>
      <View style={styles.stats}>{stats.map(({ label, value, icon, color }) => (
        <Card key={label} style={styles.statCard}><IconBox icon={icon} color={color} /><AppText style={styles.statValue}>{values[label] ?? value}</AppText><AppText style={styles.statLabel}>{label}</AppText></Card>
      ))}</View>
      <SectionTitle>Quick actions</SectionTitle>
      <View style={styles.actions}>{actions.map(({ title, caption, icon, route }) => (
        <Pressable accessibilityRole="button" key={title} onPress={() => router.push(route)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <IconBox icon={icon} /><View style={styles.actionCopy}><AppText style={styles.actionTitle}>{title}</AppText><AppText style={styles.actionCaption}>{caption}</AppText></View><ChevronRight size={17} color={colors.muted} />
        </Pressable>
      ))}</View>
      <SectionTitle right={<Pressable accessibilityRole="button" onPress={() => router.push('/history')}><AppText style={styles.viewAll}>View all</AppText></Pressable>}>Recent activity</SectionTitle>
      <Card style={styles.listCard}>
        {recent.map((visitor, index) => (
          <View key={visitor.id} style={[styles.visitorRow, index > 0 && styles.separator]}>
            <View style={styles.avatar}><AppText style={styles.initials}>{visitor.name.split(' ').map(name => name[0]).slice(0, 2).join('')}</AppText></View>
            <View style={styles.visitorCopy}><AppText style={styles.visitorName}>{visitor.name}</AppText><AppText style={styles.visitorMeta}>{visitor.purpose} · {visitor.time}</AppText></View>
            <Pill label={visitor.status === 'inside' ? 'Inside' : 'Exited'} tone={visitor.status === 'inside' ? 'green' : 'gray'} />
          </View>
        ))}
      </Card>
      <Button label="View notifications" icon={Bell} variant="outline" onPress={() => router.push('/notifications')} />
      <Button label="Emergency alert history" icon={Siren} variant="outline" onPress={() => router.push('/emergency-history')} />
    </Page>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.navy, borderRadius: 20, padding: 18, minHeight: 130, justifyContent: 'center' },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bannerSmall: { color: '#B7C7DD', fontSize: 9, letterSpacing: 1.4, fontWeight: '700' },
  bannerTitle: { color: colors.white, fontWeight: '800', fontSize: 21, marginTop: 8 },
  bannerHint: { color: '#C1CDDC', fontSize: 12, marginTop: 8 },
  live: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 16, backgroundColor: '#203B5C' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#58D49B' },
  liveText: { color: '#C4F4DC', fontSize: 9, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', flexGrow: 1, minHeight: 123, gap: 9, padding: 13 },
  statValue: { color: colors.ink, fontWeight: '800', fontSize: 22 },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  actions: { gap: 9 },
  action: { minHeight: 72, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#EDF1F6', backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  actionCaption: { color: colors.muted, fontSize: 11 },
  visitorRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 10 },
  separator: { borderTopColor: colors.line, borderTopWidth: 1 },
  avatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#EAF1FA', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 12, color: colors.navy, fontWeight: '800' },
  visitorCopy: { flex: 1, gap: 3 },
  visitorName: { fontSize: 12, fontWeight: '700', color: colors.ink },
  visitorMeta: { fontSize: 10, color: colors.muted },
  listCard: { paddingVertical: 6, paddingHorizontal: 12 },
  viewAll: { fontSize: 12, color: colors.blue, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
