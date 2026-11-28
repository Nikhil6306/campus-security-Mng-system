import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react-native';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, ChoiceChips, colors, Field, Notice, Page, Pill } from '@/components/security-ui';
import { getCampusSnapshot } from '@/services/api';

type Filter = 'All' | 'Inside' | 'Approved' | 'Checked out';

const VisitorHistoryCard = memo(function VisitorHistoryCard({ visitor }: { visitor: any }) {
  const isInside =
    visitor.status === 'Checked In' || visitor.status === 'Meeting In Progress';
  const isApproved = visitor.status === 'Approved';
  const initials = (visitor.fullName || visitor.name || 'VI')
    .split(' ')
    .map((part: string) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card style={styles.record}>
      <View style={styles.recordTop}>
        <View style={styles.avatar}>
          <AppText style={styles.initials}>{initials}</AppText>
        </View>
        <View style={styles.recordCopy}>
          <AppText style={styles.name}>{visitor.fullName || visitor.name}</AppText>
          <AppText style={styles.meta}>
            <AppText style={styles.mono}>{visitor.id}</AppText> · {visitor.visitDate || 'Today'}
          </AppText>
        </View>
        <Pill
          label={visitor.status || 'RECORD'}
          tone={isInside ? 'green' : isApproved ? 'blue' : 'gray'}
        />
      </View>

      <View style={styles.divider} />
      <AppText style={styles.meta}>
        Host: {visitor.hostName || 'Department'} · Purpose: {visitor.purpose || 'Campus Visit'}
      </AppText>
      <AppText style={styles.meta}>
        Gate: {visitor.gate || 'Main Gate'} · Phone: {visitor.mobile || visitor.phone || 'N/A'}
      </AppText>
    </Card>
  );
});

export default function HistoryScreen() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) setLoading(true);
    setError(null);
    try {
      const snap = await getCampusSnapshot(forceRefresh);
      if (snap?.visitRequests) {
        setVisits(snap.visitRequests);
      } else {
        setVisits([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visitor history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData(true);
  }, [loadData]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return visits.filter((v) => {
      const status = (v.status || '').toLowerCase();
      let matchesStatus = true;
      if (filter === 'Inside') {
        matchesStatus = status === 'checked in' || status === 'meeting in progress';
      } else if (filter === 'Approved') {
        matchesStatus = status === 'approved';
      } else if (filter === 'Checked out') {
        matchesStatus = status === 'checked out';
      }

      if (!matchesStatus) return false;
      if (!q) return true;
      const searchable = `${v.fullName || v.name || ''} ${v.mobile || v.phone || ''} ${v.id || ''} ${v.purpose || ''} ${v.hostName || ''}`.toLowerCase();
      return searchable.includes(q);
    });
  }, [visits, filter, query]);

  const keyExtractor = useCallback((item: any) => String(item.id), []);
  const renderItem = useCallback(
    ({ item }: { item: any }) => <VisitorHistoryCard visitor={item} />,
    [],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <Card style={styles.banner}>
          <AppText style={styles.count}>{visits.length}</AppText>
          <View style={{ flex: 1 }}>
            <AppText style={styles.bannerTitle}>Authorized Visitor Passes</AppText>
            <AppText style={styles.bannerCopy}>Live server records verified at university gates</AppText>
          </View>
        </Card>

        {error ? <Notice tone="red">{error}</Notice> : null}

        <Field
          label="Search history"
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, phone, purpose, or pass ID"
          right={<Search size={18} color={colors.muted} />}
        />

        <ChoiceChips
          values={['All', 'Inside', 'Approved', 'Checked out']}
          selected={filter}
          onSelect={(value) => setFilter(value as Filter)}
        />
      </View>
    ),
    [visits.length, error, query, filter],
  );

  return (
    <Page title="Visitor & Gate History" subtitle="Live Campus Registry" bottomNav scroll={false}>
      {loading ? (
        <View style={styles.headerBlock}>
          {listHeader}
          <Card style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.blue} />
            <AppText style={styles.loadingCopy}>Fetching visitor audit trail...</AppText>
          </Card>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue]} />}
          ListEmptyComponent={
            <Card style={styles.empty}>
              <AppText style={styles.emptyTitle}>No matching visits found</AppText>
              <AppText style={styles.meta}>
                Adjust your search query or select a different filter.
              </AppText>
              <Button
                label="Refresh Registry"
                icon={RefreshCw}
                variant="secondary"
                onPress={() => void loadData(true)}
              />
            </Card>
          }
        />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: 14, marginBottom: 14 },
  listContent: { padding: 16, paddingBottom: 26 },
  sep: { height: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  count: {
    backgroundColor: colors.blueSoft,
    color: colors.blue,
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  bannerCopy: { color: colors.muted, fontSize: 11, marginTop: 3 },
  record: { gap: 10 },
  recordTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#EAF1FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 13, color: colors.navy, fontWeight: '800' },
  recordCopy: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 11, color: colors.muted, lineHeight: 16 },
  mono: { fontFamily: 'monospace', fontWeight: '700', color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line },
  empty: { alignItems: 'center', gap: 8, padding: 26 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  loadingBox: { alignItems: 'center', padding: 24, gap: 8 },
  loadingCopy: { fontSize: 12, color: colors.muted },
});
