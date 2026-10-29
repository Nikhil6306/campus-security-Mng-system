import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  DoorOpen,
  LogOut,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserCheck,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, IconBox, Notice, Page, Pill, SectionTitle } from '@/components/security-ui';
import {
  getGuardDashboardData,
  getGuardSession,
  getRecentActivity,
  logoutGuard,
  startGuardShift,
  endGuardShift,
  type GuardDashboardData,
  type GuardSession,
} from '@/services/api';

export default function DashboardScreen() {
  const [session, setSession] = useState<GuardSession | null>(getGuardSession());
  const [dashData, setDashData] = useState<GuardDashboardData | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shiftInProgress, setShiftInProgress] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const current = getGuardSession();
      setSession(current);

      const [data, recentLogs] = await Promise.all([
        getGuardDashboardData(),
        getRecentActivity(),
      ]);

      if (data) {
        setDashData(data);
        // If guard has active assignment in dashData
        const activeAssigned = data.assignments?.some(
          (a: any) => a.guardId === current?.refId && a.status === 'Active'
        );
        if (activeAssigned) {
          setShiftInProgress(true);
        }
      } else {
        setError('Could not load live dashboard data. Check connection.');
      }
      setActivity(recentLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error contacting campus server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const handleToggleShift = async () => {
    setShiftLoading(true);
    try {
      if (!shiftInProgress) {
        // Start shift
        const res = await startGuardShift(session?.refId || 'default-assignment', 'Clocked in from Android Guard App');
        if (res.ok) {
          setShiftInProgress(true);
          await loadData();
        } else {
          setError(res.error || 'Failed to clock in shift.');
        }
      } else {
        // End shift
        const res = await endGuardShift({
          sessionId: 'current',
          generalNotes: 'Shift concluded via mobile application',
        });
        if (res.ok) {
          setShiftInProgress(false);
          await loadData();
        } else {
          setError(res.error || 'Failed to end shift.');
        }
      }
    } finally {
      setShiftLoading(false);
    }
  };

  const stats = [
    {
      label: 'Visitors today',
      value: String(dashData?.liveSummary.visitorsToday ?? 0),
      icon: UsersRound,
      color: colors.blue,
    },
    {
      label: 'On campus now',
      value: String(dashData?.liveSummary.visitorsInside ?? 0),
      icon: DoorOpen,
      color: colors.green,
    },
    {
      label: 'Vehicles inside',
      value: String(dashData?.liveSummary.vehiclesInside ?? 0),
      icon: UserRoundPlus,
      color: colors.blue,
    },
    {
      label: 'Active alerts',
      value: String(dashData?.liveSummary.openIncidents ?? 0),
      icon: Siren,
      color: (dashData?.liveSummary.openIncidents ?? 0) > 0 ? colors.red : colors.muted,
    },
  ];

  const actions = [
    { title: 'Scan visitor QR', caption: 'Verify visitor or outpass', icon: QrCode, route: '/scan' },
    { title: 'New check-in', caption: 'Register walk-in guest', icon: UserRoundPlus, route: '/check-in' },
    { title: 'Check-out', caption: 'Record gate exit', icon: DoorOpen, route: '/check-out' },
    { title: 'Emergency SOS', caption: 'Dispatch campus alert', icon: Siren, route: '/emergency' },
  ] as const;

  const guardName = session?.name || 'Security Officer';
  const gateName = session?.gate || 'Main Gate';
  const guardRole = session?.role?.toUpperCase() || 'SECURITY';

  return (
    <Page
      title={`Duty: ${guardName}`}
      subtitle={`${gateName} · ${guardRole}`}
      back={false}
      bottomNav
    >
      {/* Active Duty Status Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerTop}>
          <View>
            <AppText style={styles.bannerSmall}>DEV SANSKRITI VISHWAVIDYALAYA</AppText>
            <AppText style={styles.bannerTitle}>{gateName}</AppText>
            <AppText style={styles.bannerSubtitle}>
              {shiftInProgress ? 'Shift Active · Duty Logged' : 'Duty Officer On Standby'}
            </AppText>
          </View>
          <View style={[styles.live, { backgroundColor: shiftInProgress ? '#1E3D2F' : '#332917' }]}>
            <View style={[styles.dot, { backgroundColor: shiftInProgress ? '#58D49B' : colors.amber }]} />
            <AppText style={[styles.liveText, { color: shiftInProgress ? '#C4F4DC' : '#FFE8B3' }]}>
              {shiftInProgress ? 'ON DUTY' : 'STANDBY'}
            </AppText>
          </View>
        </View>

        <View style={styles.shiftActions}>
          <Button
            label={
              shiftLoading
                ? 'Updating Shift...'
                : shiftInProgress
                ? 'End Shift & Handover'
                : 'Start Active Shift'
            }
            variant={shiftInProgress ? 'secondary' : 'primary'}
            onPress={() => void handleToggleShift()}
          />
        </View>
      </View>

      {error ? (
        <Notice tone="red">{error}</Notice>
      ) : null}

      {/* Live Campus Security Statistics */}
      <View style={styles.statsHeader}>
        <SectionTitle>Gate & Campus Statistics</SectionTitle>
        <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.refreshBtn}>
          <RefreshCw size={14} color={colors.blue} />
          <AppText style={styles.refreshText}>Refresh</AppText>
        </Pressable>
      </View>

      {loading ? (
        <Card style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.blue} />
          <AppText style={styles.loadingCopy}>Fetching real-time gate metrics...</AppText>
        </Card>
      ) : (
        <View style={styles.stats}>
          {stats.map(({ label, value, icon, color }) => (
            <Card key={label} style={styles.statCard}>
              <IconBox icon={icon} color={color} />
              <AppText style={styles.statValue}>{value}</AppText>
              <AppText style={styles.statLabel}>{label}</AppText>
            </Card>
          ))}
        </View>
      )}

      {/* Primary Security Guard Actions */}
      <SectionTitle>Security Operations</SectionTitle>
      <View style={styles.actions}>
        {actions.map(({ title, caption, icon, route }) => (
          <Pressable
            accessibilityRole="button"
            key={title}
            onPress={() => router.push(route)}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <IconBox icon={icon} />
            <View style={styles.actionCopy}>
              <AppText style={styles.actionTitle}>{title}</AppText>
              <AppText style={styles.actionCaption}>{caption}</AppText>
            </View>
            <ChevronRight size={17} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      {/* Live Activity Feed */}
      <SectionTitle
        right={
          <Pressable accessibilityRole="button" onPress={() => router.push('/history')}>
            <AppText style={styles.viewAll}>View all logs</AppText>
          </Pressable>
        }
      >
        Recent Gate Activity
      </SectionTitle>

      <Card style={styles.listCard}>
        {activity.length > 0 ? (
          activity.slice(0, 4).map((item, index) => (
            <View key={item.id || index} style={[styles.visitorRow, index > 0 && styles.separator]}>
              <View style={styles.avatar}>
                <AppText style={styles.initials}>
                  {(item.name || item.type || 'GT')
                    .split(' ')
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </AppText>
              </View>
              <View style={styles.visitorCopy}>
                <AppText style={styles.visitorName}>{item.action || item.name || 'Gate Event'}</AppText>
                <AppText style={styles.visitorMeta}>
                  {item.detail || item.purpose || 'Entry/Exit activity'} ·{' '}
                  {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Recent'}
                </AppText>
              </View>
              <Pill
                label={item.status || 'LOGGED'}
                tone={
                  item.status === 'Checked In' || item.status === 'SUCCESS'
                    ? 'green'
                    : item.status === 'Checked Out'
                    ? 'gray'
                    : 'blue'
                }
              />
            </View>
          ))
        ) : (
          <View style={styles.emptyActivity}>
            <CheckCircle2 size={24} color={colors.green} />
            <AppText style={styles.emptyTitle}>Gate is clear</AppText>
            <AppText style={styles.emptyCopy}>No pending queues or anomalies recorded at this gate.</AppText>
          </View>
        )}
      </Card>

      {/* Emergency Shortcuts */}
      <Button
        label="Emergency alert history"
        icon={Siren}
        variant="outline"
        onPress={() => router.push('/emergency-history')}
      />
      <Button
        label="Notification Center"
        icon={Bell}
        variant="outline"
        onPress={() => router.push('/notifications')}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.navy,
    borderRadius: 20,
    padding: 18,
    minHeight: 140,
    justifyContent: 'center',
    gap: 14,
  },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bannerSmall: { color: '#B7C7DD', fontSize: 10, letterSpacing: 1.4, fontWeight: '700' },
  bannerTitle: { color: colors.white, fontWeight: '800', fontSize: 22, marginTop: 6 },
  bannerSubtitle: { color: '#C1CDDC', fontSize: 12, marginTop: 4 },
  live: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  liveText: { fontSize: 10, fontWeight: '800' },
  shiftActions: { marginTop: 4 },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  refreshText: { fontSize: 12, color: colors.blue, fontWeight: '700' },
  loadingBox: { alignItems: 'center', padding: 24, gap: 8 },
  loadingCopy: { fontSize: 12, color: colors.muted },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', flexGrow: 1, minHeight: 120, gap: 8, padding: 14 },
  statValue: { color: colors.ink, fontWeight: '800', fontSize: 24 },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  actions: { gap: 10 },
  action: {
    minHeight: 72,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1F6',
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  actionCaption: { color: colors.muted, fontSize: 11 },
  visitorRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 12 },
  separator: { borderTopColor: colors.line, borderTopWidth: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#EAF1FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 13, color: colors.navy, fontWeight: '800' },
  visitorCopy: { flex: 1, gap: 3 },
  visitorName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  visitorMeta: { fontSize: 11, color: colors.muted },
  listCard: { paddingVertical: 6, paddingHorizontal: 14 },
  viewAll: { fontSize: 12, color: colors.blue, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  emptyActivity: { alignItems: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  emptyCopy: { fontSize: 11, color: colors.muted, textAlign: 'center' },
});
