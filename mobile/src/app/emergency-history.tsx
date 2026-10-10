import { router } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Notice, Page, Pill } from '@/components/security-ui';
import { useDemoStore } from '@/state/demo-store';

export default function EmergencyHistoryScreen() {
  const { emergencies } = useDemoStore();
  return (
    <Page title="Emergency alert history" subtitle="Local demo log">
      <Notice tone="red">History shown here is stored only in app memory. It is not a dispatch record and is not monitored.</Notice>
      {emergencies.length ? emergencies.map(event => (
        <Card key={event.id} style={styles.event}>
          <View style={styles.top}><View style={styles.icon}><AlertTriangle size={19} color={colors.red} /></View><View style={styles.copy}><AppText style={styles.title}>{event.type}</AppText><AppText style={styles.meta}>{event.id} · {event.time}</AppText></View><Pill label="Demo log" tone="amber" /></View>
          <View style={styles.divider} />
          <AppText style={styles.meta}>{event.location}</AppText>
          <AppText style={styles.details}>{event.details}</AppText>
          <AppText style={styles.disclaimer}>No alert was sent · local demo only</AppText>
        </Card>
      )) : <Card style={styles.empty}><AlertTriangle color={colors.muted} size={28} /><AppText style={styles.title}>No emergency entries</AppText><AppText style={styles.meta}>Demo alerts you create will appear here.</AppText></Card>}
      <Button label="Create demo alert" onPress={() => router.push('/emergency')} />
    </Page>
  );
}

const styles = StyleSheet.create({
  event: { gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 13, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 10 },
  divider: { height: 1, backgroundColor: colors.line },
  details: { fontSize: 12, lineHeight: 18 },
  disclaimer: { color: colors.amber, fontWeight: '700', fontSize: 10 },
  empty: { alignItems: 'center', gap: 10, padding: 25 },
});
