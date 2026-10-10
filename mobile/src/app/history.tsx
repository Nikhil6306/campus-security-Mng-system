import { useMemo, useState } from 'react';
import { Search } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, ChoiceChips, colors, Field, Page, Pill } from '@/components/security-ui';
import { useDemoStore, type VisitorStatus } from '@/state/demo-store';

type Filter = 'All' | 'Inside' | 'Checked out';

export default function HistoryScreen() {
  const { visitors } = useDemoStore();
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const results = useMemo(() => visitors.filter(visitor => {
    const matchesStatus = filter === 'All' || visitor.status === (filter.toLowerCase() as VisitorStatus);
    const searchable = `${visitor.name} ${visitor.phone} ${visitor.id} ${visitor.purpose} ${visitor.host}`.toLowerCase();
    return matchesStatus && searchable.includes(query.toLowerCase().trim());
  }), [visitors, filter, query]);
  return (
    <Page title="Visitor history" subtitle="Recent campus visits" bottomNav>
      <Card style={styles.banner}><AppText style={styles.count}>{visitors.length}</AppText><View><AppText style={styles.bannerTitle}>Demo visitor records</AppText><AppText style={styles.bannerCopy}>Local sample data · not a live system</AppText></View></Card>
      <Field label="Search history" value={query} onChangeText={setQuery} placeholder="Search name, purpose, or ID" right={<Search size={18} color={colors.muted} />} />
      <ChoiceChips values={['All', 'Inside', 'Checked out']} selected={filter} onSelect={value => setFilter(value as Filter)} />
      {results.length ? results.map(visitor => (
          <Card key={visitor.id} style={styles.record}>
            <View style={styles.recordTop}><View style={styles.avatar}><AppText style={styles.initials}>{visitor.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</AppText></View><View style={styles.recordCopy}><AppText style={styles.name}>{visitor.name}</AppText><AppText style={styles.meta}>{visitor.id} · {visitor.time}</AppText></View><Pill label={visitor.status === 'inside' ? 'Inside' : 'Checked out'} tone={visitor.status === 'inside' ? 'green' : 'gray'} /></View>
            <View style={styles.divider} /><AppText style={styles.meta}>{visitor.purpose} · {visitor.host}</AppText><AppText style={styles.meta}>{visitor.gate} · {visitor.phone}</AppText>
          </Card>
      )) : <Card style={styles.empty}><AppText style={styles.emptyTitle}>No matching visits</AppText><AppText style={styles.meta}>Change your search or choose another status filter.</AppText></Card>}
    </Page>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15 },
  count: { backgroundColor: colors.blueSoft, color: colors.blue, fontSize: 19, fontWeight: '800', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' },
  bannerTitle: { fontSize: 13, fontWeight: '800' },
  bannerCopy: { color: colors.muted, fontSize: 10, marginTop: 3 },
  record: { gap: 9 },
  recordTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#EAF1FA', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 12, color: colors.navy, fontWeight: '800' },
  recordCopy: { flex: 1, gap: 3 },
  name: { fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 10, color: colors.muted, lineHeight: 15 },
  divider: { height: 1, backgroundColor: colors.line },
  empty: { alignItems: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
});
