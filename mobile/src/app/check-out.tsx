import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { DoorOpen, Search, UserCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, ConfirmDialog, Field, Notice, Page, Pill } from '@/components/security-ui';
import { useDemoStore, type Visitor } from '@/state/demo-store';

export default function CheckOutScreen() {
  const { visitors, checkout } = useDemoStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Visitor>();
  const [complete, setComplete] = useState('');
  const inside = useMemo(() => visitors.filter(visitor => visitor.status === 'inside' && `${visitor.name} ${visitor.phone} ${visitor.id}`.toLowerCase().includes(query.toLowerCase())), [visitors, query]);
  return (
    <Page title="Visitor check-out" subtitle="Find and record an exit">
      <Notice>Demo check-out updates only the local sample list. It does not sync with a gate or access-control system.</Notice>
      {complete ? <Notice tone="green">{complete} was checked out in this demo.</Notice> : null}
      <Field label="Search visitors currently inside" value={query} onChangeText={setQuery} placeholder="Name, phone or visitor ID" />
      {inside.length ? inside.map(visitor => (
        <Card key={visitor.id} style={styles.visitorCard}>
          <View style={styles.row}>
            <View style={styles.copy}><AppText style={styles.name}>{visitor.name}</AppText><AppText style={styles.meta}>{visitor.id} · {visitor.purpose}</AppText><AppText style={styles.meta}>{visitor.phone} · {visitor.gate}</AppText></View>
            <Pill label="Inside" tone="green" />
          </View>
          <Button label="Record demo check-out" icon={DoorOpen} variant="outline" onPress={() => { setSelected(visitor); setComplete(''); }} />
        </Card>
      )) : (
        <Card style={styles.empty}><Search size={27} color={colors.muted} /><AppText style={styles.emptyTitle}>No visitors found</AppText><AppText style={styles.meta}>Try another name or visitor ID. Only visitors marked inside are listed.</AppText></Card>
      )}
      <ConfirmDialog visible={Boolean(selected)} title="Confirm visitor exit" message={`Record ${selected?.name ?? 'this visitor'} as checked out in the local demo list?`} confirmLabel="Confirm check-out" danger onCancel={() => setSelected(undefined)} onConfirm={() => {
        if (!selected) return;
        checkout(selected.id);
        setComplete(selected.name);
        setSelected(undefined);
      }} />
      <Button label="Visitor history" icon={UserCheck} variant="secondary" onPress={() => router.push('/history')} />
    </Page>
  );
}

const styles = StyleSheet.create({
  visitorCard: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  copy: { flex: 1, gap: 5 },
  name: { fontSize: 14, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  empty: { alignItems: 'center', gap: 9, padding: 26 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
});
