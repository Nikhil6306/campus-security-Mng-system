import { useCallback, useRef, useState } from 'react';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { Camera, Flashlight, Keyboard, QrCode, Search, ShieldAlert, Sparkles } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, Card, colors, Notice, Page } from '@/components/security-ui';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(true);
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const scanned = useRef(false);

  const handleDetected = useCallback((result: BarcodeScanningResult) => {
    if (scanned.current) return;
    scanned.current = true;
    setActive(false);
    const code = result.data.trim();
    router.push({ pathname: '/verification', params: { code } });
  }, []);

  const handleManualLookup = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) {
      setError('Please enter a booking reference or visitor ID.');
      return;
    }
    setError('');
    router.push({ pathname: '/verification', params: { code: trimmed } });
  };

  const openSample = (sampleCode: string) => {
    router.push({ pathname: '/verification', params: { code: sampleCode } });
  };

  return (
    <Page title="Scan Visitor QR" subtitle="Gate Pass Scanner">
      <Notice>Point your camera at the visitor pass QR code. Live verification validates status with campus database.</Notice>

      {!permission ? (
        <Card style={styles.state}>
          <Camera size={32} color={colors.blue} />
          <AppText style={styles.stateTitle}>Checking camera permission</AppText>
          <AppText style={styles.stateCopy}>Please wait while the camera subsystem initializes...</AppText>
        </Card>
      ) : !permission.granted ? (
        <Card style={styles.state}>
          <ShieldAlert size={34} color={colors.amber} />
          <AppText style={styles.stateTitle}>Camera Access Required</AppText>
          <AppText style={styles.stateCopy}>
            {permission.canAskAgain
              ? 'Enable camera permission to scan visitor QR passes at the gate.'
              : 'Camera access is blocked in device settings. Please allow access or use manual lookup below.'}
          </AppText>
          {permission.canAskAgain ? (
            <Button
              label="Allow Camera"
              icon={Camera}
              onPress={() => {
                void requestPermission()
                  .then((value) => {
                    if (!value.granted) setError('Camera permission was refused.');
                  })
                  .catch((cause) =>
                    setError(cause instanceof Error ? cause.message : 'Unable to request camera permission.'),
                  );
              }}
            />
          ) : null}
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
        </Card>
      ) : (
        <View style={styles.cameraBox}>
          {active ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleDetected}
              onMountError={(event) => {
                setError(event.message);
                setActive(false);
              }}
            />
          ) : null}
          <View pointerEvents="none" style={styles.overlay}>
            <View style={styles.frame} />
            <AppText style={styles.frameLabel}>Align visitor QR inside frame</AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle flashlight"
            onPress={() => setTorch(!torch)}
            style={styles.torch}
          >
            <Flashlight size={20} color={torch ? '#FFD700' : colors.white} />
          </Pressable>
        </View>
      )}

      {error ? <Notice tone="red">Scanner notice: {error}</Notice> : null}

      {permission?.granted && !active ? (
        <Button
          label="Scan Another Code"
          icon={QrCode}
          onPress={() => {
            scanned.current = false;
            setActive(true);
            setError('');
          }}
        />
      ) : null}

      {/* Manual Fallback Lookup */}
      <Card style={styles.manualCard}>
        <View style={styles.manualHeader}>
          <Keyboard size={18} color={colors.blue} />
          <AppText style={styles.manualTitle}>Manual Visitor ID / Pass Lookup</AppText>
        </View>
        <AppText style={styles.stateCopy}>
          If camera is unavailable or code is unreadable, enter the booking reference printed on the pass.
        </AppText>
        <View style={styles.inputRow}>
          <TextInput
            value={manualCode}
            onChangeText={(text) => {
              setManualCode(text);
              if (error) setError('');
            }}
            placeholder="e.g. DSVV-VIS-2026-000124"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            style={styles.input}
          />
          <Pressable accessibilityRole="button" onPress={handleManualLookup} style={styles.verifyBtn}>
            <Search size={18} color={colors.white} />
            <AppText style={styles.verifyBtnText}>Verify</AppText>
          </Pressable>
        </View>
      </Card>

      {/* Quick Test Shortcuts */}
      <Card style={styles.demoCard}>
        <View style={styles.manualHeader}>
          <Sparkles size={16} color={colors.amber} />
          <AppText style={styles.demoTitle}>Quick Test Shortcuts</AppText>
        </View>
        <View style={styles.demoActions}>
          {[
            { label: 'Valid Approved', code: 'DSVV-VIS-2026-000124' },
            { label: 'Checked In', code: 'DEMO-INS-003' },
            { label: 'Pending Approval', code: 'DEMO-PND-002' },
            { label: 'Expired Pass', code: 'DEMO-EXP-001' },
          ].map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              style={styles.demoCode}
              onPress={() => openSample(item.code)}
            >
              <AppText style={styles.demoCodeText}>{item.label}</AppText>
            </Pressable>
          ))}
        </View>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  cameraBox: { height: 320, borderRadius: 20, backgroundColor: '#0A1524', overflow: 'hidden', position: 'relative' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 220, height: 220, borderWidth: 2.5, borderColor: colors.blue, borderRadius: 24, backgroundColor: 'transparent' },
  frameLabel: { color: colors.white, backgroundColor: 'rgba(8,18,31,0.7)', overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, marginTop: 14, fontSize: 11, fontWeight: '600' },
  torch: { position: 'absolute', right: 14, top: 14, width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(8,18,31,0.65)', alignItems: 'center', justifyContent: 'center' },
  state: { alignItems: 'center', gap: 12, padding: 24 },
  stateTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateCopy: { color: colors.muted, fontSize: 12, textAlign: 'left', lineHeight: 18 },
  error: { color: colors.red, fontSize: 12 },
  manualCard: { gap: 12, padding: 16 },
  manualHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  manualTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: colors.ink, backgroundColor: colors.white, fontFamily: 'monospace' },
  verifyBtn: { backgroundColor: colors.blue, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  verifyBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  demoCard: { gap: 10, padding: 14 },
  demoTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  demoActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  demoCode: { backgroundColor: colors.blueSoft, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#D0E1FD' },
  demoCodeText: { color: colors.blue, fontSize: 11, fontWeight: '700' },
});
