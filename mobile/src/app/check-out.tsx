import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { DoorOpen, RefreshCw, Search, UserCheck } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, ConfirmDialog, Field, Notice, Page, Pill } from '@/components/security-ui';
import { getCampusSnapshot, markVisitorOut } from '@/services/api';

export default function CheckOutScreen() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState<string | null>(null);

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getCampusSnapshot();
      if (snap?.visitRequests) {
        // Filter visitors who are currently on campus
        const inside = snap.visitRequests.filter(
          (v: any) => v.status === 'Checked In' || v.status === 'Meeting In Progress'
        );
        setVisitors(inside);
      } else {
        setVisitors([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch active visitors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVisitors();
  }, [loadVisitors]);

  const inside = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return visitors;
    return visitors.filter((v) =>
      `${v.fullName || v.name} ${v.mobile || v.phone} ${v.id}`.toLowerCase().includes(q)
    );
  }, [visitors, query]);

  const handleConfirmExit = async () => {
    if (!selected) return;
    setActionLoading(true);
    setError(null);

    try {
      const res = await markVisitorOut(selected.id, selected.gate || 'Main Gate', 'Recorded via guard mobile app');
      if (res.success) {
        setComplete(`${selected.fullName || selected.name} has been checked out`);
        setSelected(null);
        await loadVisitors();
      } else {
        setError(res.error || 'Failed to record visitor exit on server.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error during exit record.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Page title="Visitor Check-Out" subtitle="Gate Exit Verification">
      <Notice>Only visitors currently marked as inside campus are listed for gate exit.</Notice>

      {error ? <Notice tone="red">{error}</Notice> : null}
      {complete ? <Notice tone="green">{complete}</Notice> : null}

      <Field
        label="Search visitors currently inside"
        value={query}
        onChangeText={setQuery}
        placeholder="Search name, phone, or booking ID..."
      />

      {loading ? (
        <Card style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.blue} />
          <AppText style={styles.loadingText}>Loading campus visitor registry...</AppText>
        </Card>
      ) : inside.length > 0 ? (
        inside.map((visitor) => (
          <Card key={visitor.id} style={styles.visitorCard}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <AppText style={styles.name}>{visitor.fullName || visitor.name}</AppText>
                <AppText style={styles.meta}>
                  ID: <AppText style={styles.mono}>{visitor.id}</AppText> · {visitor.purpose || 'Visit'}
                </AppText>
                <AppText style={styles.meta}>
                  Host: {visitor.hostName || 'Department'} · Gate: {visitor.gate || 'Main Gate'}
                </AppText>
              </View>
              <Pill label="Inside" tone="green" />
            </View>
            <Button
              label="Record Gate Exit"
              icon={DoorOpen}
              variant="outline"
              onPress={() => {
                setSelected(visitor);
                setComplete(null);
              }}
            />
          </Card>
        ))
      ) : (
        <Card style={styles.empty}>
          <Search size={28} color={colors.muted} />
          <AppText style={styles.emptyTitle}>No active visitors found</AppText>
          <AppText style={styles.meta}>
            {query ? 'No matching visitors inside campus.' : 'There are currently no checked-in visitors on campus.'}
          </AppText>
          <Button
            label="Refresh Registry"
            icon={RefreshCw}
            variant="secondary"
            onPress={loadVisitors}
          />
        </Card>
      )}

      <ConfirmDialog
        visible={Boolean(selected)}
        title="Confirm Visitor Exit"
        message={`Authorize and record exit for ${selected?.fullName || selected?.name || 'this visitor'} at ${selected?.gate || 'Main Gate'}?`}
        confirmLabel={actionLoading ? 'Recording Exit...' : 'Authorize Exit'}
        danger
        onCancel={() => setSelected(null)}
        onConfirm={() => void handleConfirmExit()}
      />

      <Button
        label="View Gate History"
        icon={UserCheck}
        variant="secondary"
        onPress={() => router.push('/history')}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  loadingBox: { alignItems: 'center', gap: 10, padding: 24 },
  loadingText: { fontSize: 12, color: colors.muted },
  visitorCard: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  copy: { flex: 1, gap: 5 },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  mono: { fontFamily: 'monospace', fontWeight: '700', color: colors.ink },
  empty: { alignItems: 'center', gap: 10, padding: 26 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
});
