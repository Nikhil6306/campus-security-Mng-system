import { useEffect, useState } from 'react';
import { Bell, CheckCheck, ClipboardList, ShieldCheck, Siren } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, ChoiceChips, colors, Page, Pill } from '@/components/security-ui';
import { getCampusSnapshot } from '@/services/api';

interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  category: 'Safety' | 'Shift' | 'System';
  unread: boolean;
}

const defaultNotifications: NotificationItem[] = [
  { id: 'N-1', title: 'Shift briefing reminder', detail: 'Morning briefing at the security office.', time: 'Today · 08:00 AM', category: 'Shift', unread: true },
  { id: 'N-2', title: 'Gate checklist updated', detail: 'Main Gate checklist updated with routine patrol guidelines.', time: 'Today · 07:45 AM', category: 'System', unread: true },
  { id: 'N-3', title: 'Campus safety advisory', detail: 'Routine security protocols active across all perimeter gates.', time: 'Today · 06:00 AM', category: 'Safety', unread: false },
];

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>(defaultNotifications);
  const [filter, setFilter] = useState<'All' | 'Unread'>('All');

  useEffect(() => {
    let mounted = true;
    getCampusSnapshot().then((snapshot) => {
      if (!mounted || !snapshot?.notifications || snapshot.notifications.length === 0) return;
      const mapped: NotificationItem[] = snapshot.notifications.map((n: any, idx: number) => ({
        id: n.id || `NOTIF-${idx}`,
        title: n.title || 'Security Notification',
        detail: n.message || n.detail || '',
        time: n.at ? new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
        category: n.type === 'emergency' ? 'Safety' : n.type === 'gate' ? 'Shift' : 'System',
        unread: !n.read,
      }));
      setItems(mapped);
    }).catch(() => {
      // Keep default notifications on network error
    });
    return () => {
      mounted = false;
    };
  }, []);

  const visible = items.filter(item => filter === 'All' || item.unread);
  const markAll = () => setItems(current => current.map(item => ({ ...item, unread: false })));

  return (
    <Page
      title="Notifications"
      subtitle="Security alerts & gate updates"
      right={
        <Pressable accessibilityRole="button" onPress={markAll} style={styles.mark}>
          <CheckCheck size={18} color={colors.blue} />
        </Pressable>
      }
    >
      <Card style={styles.summary}>
        <View style={styles.bell}>
          <Bell size={22} color={colors.blue} />
        </View>
        <View style={styles.summaryCopy}>
          <AppText style={styles.summaryTitle}>Security Notices</AppText>
          <AppText style={styles.meta}>
            {items.filter(item => item.unread).length} unread updates
          </AppText>
        </View>
        <Pill label="LIVE" />
      </Card>
      <ChoiceChips values={['All', 'Unread']} selected={filter} onSelect={value => setFilter(value as 'All' | 'Unread')} />
      {visible.length ? visible.map(item => {
        const Icon = item.category === 'Safety' ? Siren : item.category === 'Shift' ? ShieldCheck : ClipboardList;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => setItems(current => current.map(record => record.id === item.id ? { ...record, unread: false } : record))}
          >
            <Card style={[styles.item, item.unread && styles.unread]}>
              <View style={styles.row}>
                <View style={styles.itemIcon}>
                  <Icon size={18} color={item.category === 'Safety' ? colors.red : colors.blue} />
                </View>
                <View style={styles.copy}>
                  <AppText style={styles.title}>{item.title}</AppText>
                  <AppText style={styles.detail}>{item.detail}</AppText>
                  <AppText style={styles.meta}>{item.time}</AppText>
                </View>
                {item.unread ? <View style={styles.unreadDot} /> : null}
              </View>
            </Card>
          </Pressable>
        );
      }) : (
        <Card style={styles.empty}>
          <Bell color={colors.muted} size={28} />
          <AppText style={styles.title}>You’re all caught up</AppText>
          <AppText style={styles.meta}>There are no pending unread notifications.</AppText>
        </Card>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  mark: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  bell: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft },
  summaryCopy: { flex: 1, gap: 4 },
  summaryTitle: { fontSize: 13, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 10 },
  item: { padding: 14 },
  unread: { borderColor: '#D5E3FF', backgroundColor: '#FBFCFF' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 5 },
  title: { fontSize: 12, fontWeight: '800' },
  detail: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue, marginTop: 4 },
  empty: { alignItems: 'center', gap: 10, padding: 24 },
});
