import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CheckCircle2, ImagePlus, UserRoundPlus } from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, ChoiceChips, colors, Field, Notice, Page, ConfirmDialog } from '@/components/security-ui';
import { createWalkInBooking, markVisitorIn } from '@/services/api';

export default function CheckInScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('Meeting');
  const [host, setHost] = useState('');
  const [gate, setGate] = useState('Main Gate');
  const [photo, setPhoto] = useState<string>();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string; gate: string; time: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const choosePhoto = async (camera: boolean) => {
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Camera permission was denied. Enable it in device settings to take a visitor photo.');
          return;
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled) setPhoto(result.assets[0].uri);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? `Unable to open photo capture: ${cause.message}` : 'Unable to open photo capture on this device.');
    }
  };

  const submit = () => {
    if (name.trim().length < 2) return setError('Enter the visitor’s full name.');
    if (!/^[0-9+\s()-]{8,16}$/.test(phone.trim())) return setError('Enter a valid phone number (8–16 digits).');
    if (!purpose) return setError('Choose the purpose of the visit.');
    if (host.trim().length < 2) return setError('Enter a department or host name.');
    setError('');
    setShowPreview(true);
  };

  const handleCreateAndCheckIn = async () => {
    setShowPreview(false);
    setSubmitting(true);
    setError('');

    try {
      // 1. Create walk-in visitor in server database
      const res = await createWalkInBooking({
        fullName: name.trim(),
        mobile: phone.trim(),
        purpose,
        hostName: host.trim(),
        gate,
        photoUrl: photo,
      });

      if (!res.ok || !res.booking) {
        setError(res.error || 'Failed to create visitor record on server.');
        return;
      }

      // 2. Mark visitor as checked in at gate
      const checkInRes = await markVisitorIn(res.booking.id, gate, 'Walk-in gate check-in via Guard Mobile App');
      if (!checkInRes.success) {
        setError(checkInRes.error || 'Visitor record created, but gate check-in failed to record.');
        return;
      }

      setCreated({
        id: res.booking.id,
        name: name.trim(),
        gate,
        time: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed while recording check-in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page title="Visitor Check-In" subtitle="Official Gate Registration">
      <Notice>Authorized security walk-in registration. Record is persisted to campus database.</Notice>

      {created ? (
        <Card style={styles.successCard}>
          <CheckCircle2 color={colors.green} size={44} />
          <AppText style={styles.successTitle}>Visitor Checked In Successfully</AppText>
          <AppText style={styles.successCopy}>{created.name}</AppText>
          <AppText style={styles.meta}>Reference ID: <AppText style={styles.mono}>{created.id}</AppText></AppText>
          <AppText style={styles.meta}>Gate: {created.gate} · Recorded at {created.time}</AppText>
          {photo ? <Image source={{ uri: photo }} style={styles.preview} alt="Visitor photo preview" /> : null}
          <Notice tone="green">Campus entry authorized and logged to security audit log.</Notice>
          <Button
            label="Register another visitor"
            variant="secondary"
            onPress={() => {
              setCreated(null);
              setName('');
              setPhone('');
              setPurpose('Meeting');
              setHost('');
              setPhoto(undefined);
            }}
          />
        </Card>
      ) : (
        <Card style={styles.form}>
          <Field
            label="Visitor full name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Ananya Sharma"
            autoCapitalize="words"
          />
          <Field
            label="Phone number *"
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
          />
          <View style={styles.control}>
            <AppText style={styles.label}>Purpose of visit *</AppText>
            <ChoiceChips
              values={['Meeting', 'Campus tour', 'Delivery', 'Official Work', 'Other']}
              selected={purpose}
              onSelect={setPurpose}
            />
          </View>
          <Field
            label="Department or host *"
            value={host}
            onChangeText={setHost}
            placeholder="e.g. Admissions / Dr. Mehta"
            autoCapitalize="words"
          />
          <View style={styles.control}>
            <AppText style={styles.label}>Entry gate</AppText>
            <ChoiceChips
              values={['Main Gate', 'North Gate', 'Service Gate']}
              selected={gate}
              onSelect={setGate}
            />
          </View>
          <View style={styles.control}>
            <AppText style={styles.label}>Visitor photo <AppText style={styles.optional}>(optional)</AppText></AppText>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} alt="Selected visitor photo" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <ImagePlus color={colors.muted} size={24} />
                <AppText style={styles.photoText}>Attach visitor photo for badge</AppText>
              </View>
            )}
            <View style={styles.photoActions}>
              <Pressable accessibilityRole="button" style={styles.photoAction} onPress={() => void choosePhoto(true)}>
                <Camera size={16} color={colors.blue} />
                <AppText style={styles.photoActionText}>Take photo</AppText>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.photoAction} onPress={() => void choosePhoto(false)}>
                <ImagePlus size={16} color={colors.blue} />
                <AppText style={styles.photoActionText}>Choose photo</AppText>
              </Pressable>
            </View>
          </View>
          {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
          <Button
            label={submitting ? 'Registering & Granting Entry...' : 'Submit & Check In'}
            icon={UserRoundPlus}
            onPress={submit}
          />
        </Card>
      )}

      <ConfirmDialog
        visible={showPreview}
        title="Confirm Visitor Entry"
        message={`${name.trim()} · ${phone.trim()}\n${purpose} with ${host.trim()}\nEntry at: ${gate}${photo ? '\nVisitor photo attached.' : ''}\n\nRecord entry to campus and log gate movement?`}
        confirmLabel="Authorize & Check In"
        onCancel={() => setShowPreview(false)}
        onConfirm={() => void handleCreateAndCheckIn()}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  form: { gap: 17 },
  control: { gap: 9 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  optional: { color: colors.muted, fontSize: 11, fontWeight: '400' },
  photoPlaceholder: { height: 110, borderRadius: 14, backgroundColor: '#F0F4FA', borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoText: { color: colors.muted, fontSize: 12 },
  photo: { height: 160, borderRadius: 14 },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoAction: { flex: 1, height: 40, borderRadius: 12, backgroundColor: colors.blueSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoActionText: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  error: { color: colors.red, fontSize: 12 },
  successCard: { alignItems: 'center', gap: 12, padding: 22 },
  successTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', color: colors.ink },
  successCopy: { fontSize: 15, fontWeight: '700', color: colors.blue },
  meta: { fontSize: 12, color: colors.muted },
  mono: { fontFamily: 'monospace', fontWeight: '700', color: colors.ink },
  preview: { width: 90, height: 90, borderRadius: 16, marginTop: 4 },
});
