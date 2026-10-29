import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  Car,
  CheckCircle2,
  CircleX,
  Clock,
  DoorOpen,
  History,
  LogIn,
  LogOut,
  RotateCcw,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, ConfirmDialog, Notice, Page, Pill } from '@/components/security-ui';
import {
  API_BASE_URL,
  markVisitorIn,
  markVisitorOut,
  type MobileVerificationResult,
  verifyVisitorPass,
} from '@/services/api';

export default function VerificationScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<MobileVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'in' | 'out' | null>(null);
  const [completed, setCompleted] = useState<{
    action: 'IN' | 'OUT';
    timestamp: string;
    gate: string;
    guard: string;
  } | null>(null);

  const loadVerification = useCallback(async () => {
    if (!code) {
      setError('No scan token or reference provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await verifyVisitorPass({ token: code, bookingId: code });
      setResult(res);
      if (!res.ok && res.issues.length > 0) {
        setError(res.issues[0].message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify pass.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void loadVerification();
  }, [loadVerification]);

  const handleConfirmAction = async () => {
    if (!result?.booking || !confirmAction) return;
    const bookingId = result.booking.id;
    const gate = result.booking.gate || 'Main Gate';
    setActionLoading(true);

    try {
      if (confirmAction === 'in') {
        const op = await markVisitorIn(bookingId, gate);
        if (op.success) {
          setCompleted({
            action: 'IN',
            timestamp: op.timestamp || new Date().toLocaleTimeString(),
            gate: op.gate || gate,
            guard: op.guardName || 'Gate Officer',
          });
          // Refresh state
          await loadVerification();
        } else {
          setError(op.error || 'Failed to check in visitor.');
        }
      } else {
        const op = await markVisitorOut(bookingId, gate);
        if (op.success) {
          setCompleted({
            action: 'OUT',
            timestamp: op.timestamp || new Date().toLocaleTimeString(),
            gate: op.gate || gate,
            guard: op.guardName || 'Gate Officer',
          });
          await loadVerification();
        } else {
          setError(op.error || 'Failed to check out visitor.');
        }
      }
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const booking = result?.booking;
  const status = booking?.status || 'Unknown';
  const isInside = status === 'Checked In' || status === 'Meeting In Progress';
  const isApproved = status === 'Approved';
  const isPending = status === 'Pending' || status === 'Rescheduled';
  const isExpired = status === 'Expired';
  const isCheckedOut = status === 'Checked Out';
  const isRejected = status === 'Rejected';

  return (
    <Page title="Pass Verification" subtitle="Security Gate Live Verification">
      {/* Loading state */}
      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.blue} />
          <AppText style={styles.loadingTitle}>Verifying with Campus Database...</AppText>
          <AppText style={styles.meta}>Checking pass token, identity validity, and gate clearance rules.</AppText>
        </Card>
      ) : null}

      {/* Completion Banner */}
      {completed ? (
        <Card style={[styles.statusCard, { backgroundColor: colors.greenSoft, borderColor: '#B2E5D0' }]}>
          <View style={styles.statusRow}>
            <CheckCircle2 color={colors.green} size={26} />
            <View style={{ flex: 1 }}>
              <AppText style={[styles.statusTitle, { color: colors.green }]}>
                Visitor Marked {completed.action} Successfully
              </AppText>
              <AppText style={styles.meta}>
                Recorded at {completed.gate} · {completed.timestamp} by {completed.guard}
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Verification Status Header */}
      {!loading && result ? (
        <Card
          style={[
            styles.statusCard,
            {
              backgroundColor:
                isInside
                  ? colors.blueSoft
                  : result.ok
                  ? colors.greenSoft
                  : isPending
                  ? colors.amberSoft
                  : colors.redSoft,
            },
          ]}
        >
          <View style={styles.statusRow}>
            {isInside ? (
              <DoorOpen color={colors.blue} size={30} />
            ) : result.ok ? (
              <BadgeCheck color={colors.green} size={30} />
            ) : isPending ? (
              <Clock color={colors.amber} size={30} />
            ) : (
              <CircleX color={colors.red} size={30} />
            )}
            <View style={{ flex: 1 }}>
              <Pill
                label={
                  isInside
                    ? 'ALREADY CHECKED IN (INSIDE)'
                    : isApproved && result.ok
                    ? 'APPROVED & VALID FOR ENTRY'
                    : isPending
                    ? 'PENDING SUPERVISOR APPROVAL'
                    : isExpired
                    ? 'EXPIRED PASS'
                    : isCheckedOut
                    ? 'CHECKED OUT'
                    : isRejected
                    ? 'ENTRY REJECTED'
                    : 'INVALID PASS'
                }
                tone={
                  isInside ? 'blue' : result.ok ? 'green' : isPending ? 'amber' : 'red'
                }
              />
              <AppText
                style={[
                  styles.statusTitle,
                  {
                    color:
                      isInside
                        ? colors.blue
                        : result.ok
                        ? colors.green
                        : isPending
                        ? colors.amber
                        : colors.red,
                  },
                ]}
              >
                {isInside
                  ? 'Visitor Currently Inside Campus'
                  : result.ok
                  ? 'Eligible for Campus Entry'
                  : isPending
                  ? 'Entry Not Permitted — Awaiting Review'
                  : isExpired
                  ? 'Pass Window Has Lapsed'
                  : isCheckedOut
                  ? 'Pass Has Been Used & Closed'
                  : 'Pass Refused by Security Policy'}
              </AppText>
              {error ? <AppText style={styles.errorText}>{error}</AppText> : null}
            </View>
          </View>
        </Card>
      ) : null}

      {/* Visitor Details Card */}
      {!loading && booking ? (
        <Card style={styles.visitorCard}>
          <View style={styles.personHeader}>
            {booking.photoUrl ? (
              <Image
                source={{
                  uri: booking.photoUrl.startsWith('http')
                    ? booking.photoUrl
                    : `${API_BASE_URL}/api/visitor-photo/${booking.photoUrl.replace(/^visitor-photos\//, '').replace(/\.[a-z]+$/, '')}`,
                }}
                style={styles.photo}
                alt={booking.fullName}
              />
            ) : (
              <View style={styles.avatar}>
                <AppText style={styles.avatarInitials}>
                  {booking.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </AppText>
              </View>
            )}

            <View style={{ flex: 1, gap: 3 }}>
              <AppText style={styles.visitorName}>{booking.fullName}</AppText>
              <AppText style={styles.meta}>
                ID: <AppText style={styles.mono}>{booking.id}</AppText>
              </AppText>
              <AppText style={styles.meta}>
                Phone: <AppText style={styles.mono}>{booking.whatsappCountryCode || '+91'} {booking.whatsappNumber || booking.mobile}</AppText>
              </AppText>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Key Details Grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <View style={styles.detailLabelRow}>
                <User size={13} color={colors.muted} />
                <AppText style={styles.detailLabel}>HOST</AppText>
              </View>
              <AppText style={styles.detailValue}>{booking.hostName || 'Campus Administration'}</AppText>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailLabelRow}>
                <Calendar size={13} color={colors.muted} />
                <AppText style={styles.detailLabel}>DATE & TIME</AppText>
              </View>
              <AppText style={styles.detailValue}>
                {booking.visitDate} · {booking.visitTime}
              </AppText>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailLabelRow}>
                <Users size={13} color={colors.muted} />
                <AppText style={styles.detailLabel}>PURPOSE</AppText>
              </View>
              <AppText style={styles.detailValue}>{booking.purpose || 'Campus Visit'}</AppText>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailLabelRow}>
                <Car size={13} color={colors.muted} />
                <AppText style={styles.detailLabel}>VEHICLE</AppText>
              </View>
              <AppText style={styles.detailValue}>
                {booking.hasCar || booking.vehicleRequired
                  ? booking.carNumber || booking.vehicleNumber || 'Vehicle Declared'
                  : 'No Vehicle'}
              </AppText>
            </View>
          </View>

          {/* Active IN / OUT Action Buttons */}
          <View style={styles.actionBox}>
            {result?.nextAction === 'check-in' || (result?.ok && !isInside) ? (
              <Button
                label={actionLoading ? 'Recording Entry...' : `Mark IN at ${booking.gate || 'Gate'}`}
                icon={LogIn}
                onPress={() => setConfirmAction('in')}
              />
            ) : null}

            {result?.nextAction === 'check-out' || isInside ? (
              <Button
                label={actionLoading ? 'Recording Exit...' : `Mark OUT at ${booking.gate || 'Gate'}`}
                icon={LogOut}
                variant="secondary"
                onPress={() => setConfirmAction('out')}
              />
            ) : null}

            {!result?.ok && !isInside ? (
              <Notice tone="red">
                Entry authorization rejected. Please direct visitor to the Security Office.
              </Notice>
            ) : null}
          </View>
        </Card>
      ) : null}

      {/* Entry/Exit History */}
      {!loading && result?.history && result.history.length > 0 ? (
        <Card style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <History size={16} color={colors.navy} />
            <AppText style={styles.historyTitle}>Entry / Exit Event History</AppText>
          </View>

          {result.history.map((item, idx) => (
            <View key={item.id || idx} style={[styles.historyRow, idx > 0 && styles.historySeparator]}>
              <Pill
                label={item.direction === 'In' ? 'ENTRY' : 'EXIT'}
                tone={item.direction === 'In' ? 'green' : 'gray'}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={styles.historyGate}>{item.gate} · {item.guardName}</AppText>
                <AppText style={styles.historyTime}>
                  {new Date(item.at).toLocaleString()}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(confirmAction)}
        title={confirmAction === 'in' ? 'Confirm Gate Check-In' : 'Confirm Gate Check-Out'}
        message={
          confirmAction === 'in'
            ? `Are you sure you want to grant entry and mark ${booking?.fullName || 'this visitor'} IN at ${booking?.gate || 'Main Gate'}?`
            : `Are you sure you want to record ${booking?.fullName || 'this visitor'} as checked OUT from campus?`
        }
        confirmLabel={confirmAction === 'in' ? 'Authorize & Check IN' : 'Record & Check OUT'}
        danger={confirmAction === 'out'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirmAction()}
      />

      {/* Navigation Buttons */}
      <View style={styles.bottomActions}>
        <Button
          label="Scan Another QR Pass"
          icon={RotateCcw}
          variant="outline"
          onPress={() => router.replace('/scan')}
        />
        <Button
          label="Back to Guard Dashboard"
          variant="secondary"
          onPress={() => router.replace('/dashboard')}
        />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  loadingCard: { alignItems: 'center', gap: 12, padding: 30 },
  loadingTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  statusCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusTitle: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  errorText: { fontSize: 12, color: colors.red, marginTop: 4, lineHeight: 16 },
  meta: { fontSize: 11, color: colors.muted },
  mono: { fontFamily: 'monospace', fontWeight: '700', color: colors.ink },
  visitorCard: { padding: 18, gap: 14, borderRadius: 18 },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photo: { width: 62, height: 62, borderRadius: 16, backgroundColor: '#EAF1FA' },
  avatar: { width: 62, height: 62, borderRadius: 16, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 20, fontWeight: '800', color: colors.blue },
  visitorName: { fontSize: 18, fontWeight: '800', color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailItem: { width: '47%', flexGrow: 1, gap: 4 },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailLabel: { fontSize: 10, letterSpacing: 1.2, fontWeight: '700', color: colors.muted },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.ink },
  actionBox: { gap: 10, marginTop: 6 },
  historyCard: { padding: 16, gap: 12, borderRadius: 16 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  historySeparator: { borderTopWidth: 1, borderTopColor: colors.line },
  historyGate: { fontSize: 12, fontWeight: '700', color: colors.ink },
  historyTime: { fontSize: 10, color: colors.muted },
  bottomActions: { gap: 10, marginTop: 10 },
});
