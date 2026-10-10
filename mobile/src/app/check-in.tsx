import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CheckCircle2, ImagePlus, UserRoundPlus } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, ChoiceChips, colors, Field, Notice, Page, ConfirmDialog } from '@/components/security-ui';
import { useDemoStore, type Visitor } from '@/state/demo-store';

export default function CheckInScreen() {
  const { addVisitor } = useDemoStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [host, setHost] = useState('');
  const [gate, setGate] = useState('Main Gate');
  const [photo, setPhoto] = useState<string>();
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Visitor>();
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

  return (
    <Page title="Visitor check-in" subtitle="Register a campus guest">
      <Notice>Demo entry only. No visitor record is sent to campus systems or used to authorize entry.</Notice>
      {created ? (
        <Card style={styles.successCard}>
          <CheckCircle2 color={colors.green} size={44} />
          <AppText style={styles.successTitle}>Demo check-in recorded</AppText>
          <AppText style={styles.successCopy}>{created.name} · {created.id}</AppText>
          {created.photo ? <Image source={{ uri: created.photo }} style={styles.preview} alt="Visitor photo preview" /> : null}
          <Notice tone="green">Sample QR reference: {created.qrCode}. This is not an access credential.</Notice>
          <Button label="Register another visitor" variant="secondary" onPress={() => { setCreated(undefined); setName(''); setPhone(''); setPurpose(''); setHost(''); setPhoto(undefined); }} />
        </Card>
      ) : (
        <>
          <Card style={styles.form}>
            <Field label="Visitor full name *" value={name} onChangeText={setName} placeholder="e.g. Ananya Sharma" autoCapitalize="words" />
            <Field label="Phone number *" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
            <View style={styles.control}><AppText style={styles.label}>Purpose of visit *</AppText><ChoiceChips values={['Meeting', 'Campus tour', 'Delivery', 'Other']} selected={purpose} onSelect={setPurpose} /></View>
            <Field label="Department or host *" value={host} onChangeText={setHost} placeholder="e.g. Admissions / Dr. Mehta" autoCapitalize="words" />
            <View style={styles.control}><AppText style={styles.label}>Entry gate</AppText><ChoiceChips values={['Main Gate', 'North Gate', 'Service Gate']} selected={gate} onSelect={setGate} /></View>
            <View style={styles.control}>
              <AppText style={styles.label}>Visitor photo <AppText style={styles.optional}>(optional)</AppText></AppText>
              {photo ? <Image source={{ uri: photo }} style={styles.photo} alt="Selected visitor photo" /> : <View style={styles.photoPlaceholder}><ImagePlus color={colors.muted} size={24} /><AppText style={styles.photoText}>Add a photo for this demo record</AppText></View>}
              <View style={styles.photoActions}>
                <Pressable accessibilityRole="button" style={styles.photoAction} onPress={() => void choosePhoto(true)}><Camera size={16} color={colors.blue} /><AppText style={styles.photoActionText}>Take photo</AppText></Pressable>
                <Pressable accessibilityRole="button" style={styles.photoAction} onPress={() => void choosePhoto(false)}><ImagePlus size={16} color={colors.blue} /><AppText style={styles.photoActionText}>Choose photo</AppText></Pressable>
              </View>
            </View>
            {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
            <Button label="Preview & record demo check-in" icon={UserRoundPlus} onPress={submit} />
          </Card>
        </>
      )}
      <ConfirmDialog
        visible={showPreview}
        title="Review visitor check-in"
        message={`${name.trim()} · ${phone.trim()}\n${purpose} with ${host.trim()}\nEntry: ${gate}${photo ? '\nVisitor photo attached.' : ''}\n\nThis creates a local demo record only.`}
        confirmLabel="Record demo check-in"
        onCancel={() => setShowPreview(false)}
        onConfirm={() => {
          setCreated(addVisitor({ name: name.trim(), phone: phone.trim(), purpose, host: host.trim(), gate, photo }));
          setShowPreview(false);
        }}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  form: { gap: 17 },
  control: { gap: 9 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  optional: { color: colors.muted, fontSize: 11, fontWeight: '400' },
  photoPlaceholder: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9D3E0', backgroundColor: '#F8FAFD' },
  photoText: { fontSize: 11, color: colors.muted },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoAction: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 42, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.blueSoft },
  photoActionText: { fontSize: 11, fontWeight: '700', color: colors.blue },
  photo: { width: '100%', height: 180, borderRadius: 14, backgroundColor: colors.canvas },
  error: { color: colors.red, fontSize: 12 },
  successCard: { alignItems: 'center', gap: 13, padding: 24 },
  successTitle: { fontWeight: '800', fontSize: 20 },
  successCopy: { color: colors.muted, fontSize: 13 },
  preview: { width: 140, height: 140, borderRadius: 20 },
});
