import { useState } from 'react';
import { router } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  HeartPulse,
  MapPin,
  ShieldAlert,
  Siren,
} from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, ConfirmDialog, Field, Notice, Page } from '@/components/security-ui';
import { triggerEmergencySos } from '@/services/api';

const emergencyTypes = [
  {
    category: 'Medical Emergency' as const,
    caption: 'Injury, unconsciousness, severe health concern',
    icon: HeartPulse,
    color: colors.red,
    severity: 'Critical' as const,
  },
  {
    category: 'Fire or Smoke' as const,
    caption: 'Active fire, smoke, gas leak, building evacuation',
    icon: Flame,
    color: '#D86B2F',
    severity: 'Critical' as const,
  },
  {
    category: 'Security Threat' as const,
    caption: 'Active intruder, assault, weapon, physical violence',
    icon: ShieldAlert,
    color: colors.navy,
    severity: 'Critical' as const,
  },
  {
    category: 'Suspicious Activity' as const,
    caption: 'Trespassing, unattended baggage, unauthorized vehicle',
    icon: AlertTriangle,
    color: colors.amber,
    severity: 'High' as const,
  },
  {
    category: 'Other Emergency' as const,
    caption: 'Power outage, structural hazard, urgent situation',
    icon: Siren,
    color: colors.blue,
    severity: 'Medium' as const,
  },
];

export default function EmergencyScreen() {
  const [selectedType, setSelectedType] = useState<(typeof emergencyTypes)[number] | null>(null);
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentIncident, setSentIncident] = useState<any>(null);

  const handleSubmit = () => {
    if (!selectedType) return setError('Please select an emergency category.');
    if (location.trim().length < 2) return setError('Enter the campus building or gate location.');
    setError('');
    setConfirm(true);
  };

  const handleDispatchSos = async () => {
    if (!selectedType) return;
    setConfirm(false);
    setLoading(true);
    setError('');

    try {
      const res = await triggerEmergencySos({
        category: selectedType.category,
        severity: selectedType.severity,
        title: `${selectedType.category} at ${location.trim()}`,
        description: details.trim() || undefined,
        area: location.trim(),
      });

      if (res.ok && res.incident) {
        setSentIncident(res.incident);
      } else {
        setError(res.error || 'Server rejected emergency dispatch. Follow manual protocol.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Network failure: Emergency SOS could not reach the server.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title="Emergency SOS Dispatch" subtitle="Campus Incident Notification">
      <Notice tone="red">
        Raising an emergency SOS broadcasts an immediate high-priority alert to the Security Control Room and on-duty responders.
      </Notice>

      {sentIncident ? (
        <Card style={styles.success}>
          <CheckCircle2 size={40} color={colors.green} />
          <AppText style={styles.successTitle}>SOS Dispatched to Control Room</AppText>
          <AppText style={styles.successId}>
            Incident ID: <AppText style={styles.mono}>{sentIncident.id}</AppText>
          </AppText>
          <AppText style={styles.successMeta}>
            Category: {sentIncident.category} · Priority: {sentIncident.severity}
          </AppText>
          <AppText style={styles.successMeta}>
            Location: {sentIncident.area || location}
          </AppText>
          <Notice tone="green">
            Status: {sentIncident.status || 'Dispatched'}. Supervisors and emergency units have been notified.
          </Notice>
          <Button
            label="View Emergency History"
            variant="outline"
            onPress={() => router.push('/emergency-history')}
          />
          <Button
            label="Return to Dashboard"
            variant="secondary"
            onPress={() => router.replace('/dashboard')}
          />
        </Card>
      ) : (
        <>
          <AppText style={styles.section}>Select Emergency Nature</AppText>
          <View style={styles.options}>
            {emergencyTypes.map((item) => {
              const selected = selectedType?.category === item.category;
              const Icon = item.icon;
              return (
                <Card key={item.category} style={[styles.option, selected && styles.selected]}>
                  <View style={[styles.icon, { backgroundColor: selected ? '#FFF0F0' : colors.canvas }]}>
                    <Icon size={22} color={item.color} />
                  </View>
                  <View style={styles.optionCopy}>
                    <AppText style={styles.optionTitle}>{item.category}</AppText>
                    <AppText style={styles.copy}>{item.caption}</AppText>
                  </View>
                  <Button
                    label={selected ? 'Selected' : 'Select'}
                    variant={selected ? 'secondary' : 'outline'}
                    onPress={() => setSelectedType(item)}
                  />
                </Card>
              );
            })}
          </View>

          <Card style={styles.form}>
            <Field
              label="Incident Location *"
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Main Gate / Science Block / Library"
              right={<MapPin size={18} color={colors.muted} />}
              autoCapitalize="words"
            />
            <Field
              label="Incident Details & Symptoms"
              value={details}
              onChangeText={setDetails}
              placeholder="Describe situation, casualties, or immediate hazards..."
              multiline
            />
            {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
            <Button
              label={loading ? 'Dispatching SOS...' : 'Trigger Emergency SOS'}
              icon={Siren}
              variant="danger"
              onPress={handleSubmit}
            />
          </Card>
        </>
      )}

      <ConfirmDialog
        visible={confirm}
        title="Confirm Emergency SOS Dispatch"
        message={`Are you sure you want to trigger a ${selectedType?.severity.toUpperCase()} PRIORITY alert for "${selectedType?.category}" at ${location}?\n\nThis will instantly alert all active campus security supervisors.`}
        confirmLabel={loading ? 'Dispatching...' : 'Dispatch SOS Now'}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => void handleDispatchSos()}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '800', color: colors.ink },
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  selected: { borderColor: '#EDB8BB', backgroundColor: '#FFFAFA' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  optionCopy: { flex: 1, gap: 3 },
  optionTitle: { fontWeight: '700', fontSize: 13, color: colors.ink },
  copy: { fontSize: 11, color: colors.muted, lineHeight: 15 },
  form: { gap: 14 },
  error: { fontSize: 12, color: colors.red, fontWeight: '600' },
  success: { alignItems: 'center', gap: 12, padding: 24 },
  successTitle: { fontWeight: '800', fontSize: 18, color: colors.ink, textAlign: 'center' },
  successId: { fontSize: 13, color: colors.muted },
  mono: { fontFamily: 'monospace', fontWeight: '700', color: colors.ink },
  successMeta: { fontSize: 12, color: colors.muted },
});
