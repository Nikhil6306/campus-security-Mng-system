import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { AlertTriangle, Clock, RefreshCw, ShieldAlert, Siren } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Notice, Page, Pill } from '@/components/security-ui';
import { getEmergencyIncidents } from '@/services/api';

export default function EmergencyHistoryScreen() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEmergencyIncidents();
      setIncidents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch incidents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  return (
    <Page title="Emergency Incident Log" subtitle="Authoritative Campus SOS Records">
      <Notice>Real-time feed of campus emergency incidents, responder assignments, and resolution statuses.</Notice>

      {error ? <Notice tone="red">{error}</Notice> : null}

      {loading ? (
        <Card style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.blue} />
          <AppText style={styles.loadingCopy}>Fetching incident records...</AppText>
        </Card>
      ) : incidents.length > 0 ? (
        incidents.map((event) => {
          const isCritical = event.severity === 'Critical';
          const isResolved = event.status === 'Resolved' || event.status === 'Closed';
          return (
            <Card key={event.id} style={styles.event}>
              <View style={styles.top}>
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: isCritical ? colors.redSoft : colors.amberSoft },
                  ]}
                >
                  <AlertTriangle size={20} color={isCritical ? colors.red : colors.amber} />
                </View>
                <View style={styles.copy}>
                  <AppText style={styles.title}>{event.category || event.title}</AppText>
                  <AppText style={styles.meta}>
                    ID: <AppText style={styles.mono}>{event.id}</AppText> ·{' '}
                    {event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : 'Recent'}
                  </AppText>
                </View>
                <Pill
                  label={event.status || 'REPORTED'}
                  tone={isResolved ? 'green' : isCritical ? 'red' : 'amber'}
                />
              </View>

              <View style={styles.divider} />
              <AppText style={styles.meta}>Location: {event.area || event.building || 'Campus'}</AppText>
              {event.description ? (
                <AppText style={styles.details}>{event.description}</AppText>
              ) : null}
              {event.assignedGuardId ? (
                <AppText style={styles.responder}>Assigned Responder: {event.assignedGuardId}</AppText>
              ) : null}
            </Card>
          );
        })
      ) : (
        <Card style={styles.empty}>
          <ShieldAlert color={colors.green} size={30} />
          <AppText style={styles.emptyTitle}>No Active Emergency Alerts</AppText>
          <AppText style={styles.emptyCopy}>All campus zones are currently operating under normal conditions.</AppText>
          <Button
            label="Refresh Log"
            icon={RefreshCw}
            variant="secondary"
            onPress={loadIncidents}
          />
        </Card>
      )}

      <Button
        label="Dispatch New Emergency SOS"
        icon={Siren}
        variant="danger"
        onPress={() => router.push('/emergency')}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  loadingBox: { alignItems: 'center', padding: 24, gap: 8 },
  loadingCopy: { fontSize: 12, color: colors.muted },
  event: { gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 11 },
  mono: { fontFamily: 'monospace', fontWeight: '700', color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line },
  details: { fontSize: 12, color: colors.ink, lineHeight: 18 },
  responder: { fontSize: 11, fontWeight: '700', color: colors.blue },
  empty: { alignItems: 'center', gap: 10, padding: 25 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  emptyCopy: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
