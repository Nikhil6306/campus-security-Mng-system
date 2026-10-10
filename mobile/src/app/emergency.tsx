import { useState } from 'react';
import { router } from 'expo-router';
import { AlertTriangle, Flame, HeartPulse, MapPin, ShieldAlert, Siren } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, ConfirmDialog, Field, Notice, Page } from '@/components/security-ui';
import { useDemoStore } from '@/state/demo-store';

const options = [
  { type: 'Medical assistance', caption: 'Injury or health concern', icon: HeartPulse, color: colors.red },
  { type: 'Fire or smoke', caption: 'Fire, smoke, or evacuation', icon: Flame, color: '#D86B2F' },
  { type: 'Security threat', caption: 'Immediate safety concern', icon: ShieldAlert, color: colors.navy },
  { type: 'Suspicious activity', caption: 'Person, item, or behavior', icon: AlertTriangle, color: colors.amber },
  { type: 'Other emergency', caption: 'Other urgent campus issue', icon: Siren, color: colors.blue },
];

export default function EmergencyScreen() {
  const { addEmergency } = useDemoStore();
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = () => {
    if (!type) return setError('Select an emergency type.');
    if (location.trim().length < 3) return setError('Enter the campus location.');
    setError('');
    setConfirm(true);
  };
  return (
    <Page title="Emergency response" subtitle="Choose a response category">
      <Notice tone="red">This screen does not call emergency services, dispatch staff, or transmit an alert. Use campus emergency procedures for real incidents.</Notice>
      {sent ? <Card style={styles.success}><Siren size={30} color={colors.green} /><AppText style={styles.successTitle}>Demo alert logged locally</AppText><AppText style={styles.copy}>No responder was contacted. The entry appears in this device’s emergency history.</AppText><Button label="View alert history" onPress={() => router.push('/emergency-history')} /></Card> : (
        <>
          <AppText style={styles.section}>What’s happening?</AppText>
          <View style={styles.options}>{options.map(({ type: label, caption, icon: Icon, color }) => {
            const selected = type === label;
            return <Card key={label} style={[styles.option, selected && styles.selected]}>
              <View style={[styles.icon, { backgroundColor: selected ? '#FFF0F0' : colors.canvas }]}><Icon size={21} color={color} /></View>
              <View style={styles.optionCopy}><AppText style={styles.optionTitle}>{label}</AppText><AppText style={styles.copy}>{caption}</AppText></View>
              <Button label={selected ? 'Selected' : 'Select'} variant={selected ? 'secondary' : 'outline'} onPress={() => setType(label)} />
            </Card>;
          })}</View>
          <Card style={styles.form}>
            <Field label="Incident location *" value={location} onChangeText={setLocation} placeholder="Building, floor, or gate" right={<MapPin size={18} color={colors.muted} />} autoCapitalize="words" />
            <Field label="Additional details" value={details} onChangeText={setDetails} placeholder="Brief details for this local record" multiline />
            {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
            <Button label="Review demo alert" icon={Siren} variant="danger" onPress={submit} />
          </Card>
        </>
      )}
      <ConfirmDialog visible={confirm} title="Log a demo emergency?" message={`A local sample entry will be created for "${type}" at ${location}. No alert will be sent to anyone.`} confirmLabel="Log locally" danger onCancel={() => setConfirm(false)} onConfirm={() => {
        addEmergency({ type, location: `${location.trim()} · Demo`, details: details.trim() || 'No additional details' });
        setConfirm(false);
        setSent(true);
      }} />
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '800' },
  options: { gap: 9 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  selected: { borderColor: '#EDB8BB', backgroundColor: '#FFFAFA' },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  optionCopy: { flex: 1, gap: 3 },
  optionTitle: { fontWeight: '700', fontSize: 12 },
  copy: { fontSize: 10, color: colors.muted, lineHeight: 15 },
  form: { gap: 14 },
  error: { fontSize: 12, color: colors.red },
  success: { alignItems: 'center', gap: 13, padding: 24 },
  successTitle: { fontWeight: '800', fontSize: 18 },
});
