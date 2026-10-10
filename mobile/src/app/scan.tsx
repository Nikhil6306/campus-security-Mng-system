import { useCallback, useRef, useState } from 'react';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { Camera, Flashlight, QrCode, ShieldAlert } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Notice, Page } from '@/components/security-ui';
import { useDemoStore } from '@/state/demo-store';

function getStatus(code: string, visitors: ReturnType<typeof useDemoStore>['visitors']) {
  const visitor = visitors.find(item => item.qrCode.toLowerCase() === code.trim().toLowerCase());
  if (visitor?.status === 'checked out') return { status: 'used', visitor: visitor.name };
  if (visitor) return { status: 'valid', visitor: visitor.name };
  if (/expired/i.test(code)) return { status: 'expired', visitor: '' };
  return { status: 'invalid', visitor: '' };
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(true);
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState('');
  const scanned = useRef(false);
  const { visitors } = useDemoStore();
  const finishScan = useCallback((result: BarcodeScanningResult) => {
    if (scanned.current) return;
    scanned.current = true;
    setActive(false);
    const resultStatus = getStatus(result.data, visitors);
    router.push({ pathname: '/verification', params: { ...resultStatus, code: result.data } });
  }, [visitors]);

  const openDemo = (code: string) => {
    const resultStatus = getStatus(code, visitors);
    router.push({ pathname: '/verification', params: { ...resultStatus, code } });
  };

  return (
    <Page title="Scan visitor QR" subtitle="Pass scanner · demo mode">
      <Notice>Scan uses your device camera when available. QR results are local sample lookups, not access authorization.</Notice>
      {!permission ? (
        <Card style={styles.state}><Camera size={28} color={colors.blue} /><AppText style={styles.stateTitle}>Checking camera permission</AppText><AppText style={styles.stateCopy}>Please wait while the device camera becomes ready.</AppText></Card>
      ) : !permission.granted ? (
        <Card style={styles.state}>
          <ShieldAlert size={30} color={colors.amber} />
          <AppText style={styles.stateTitle}>Camera permission needed</AppText>
          <AppText style={styles.stateCopy}>{permission.canAskAgain ? 'Allow camera access to scan a visitor QR code.' : 'Camera access is blocked. Enable it in your device or browser settings.'}</AppText>
          {permission.canAskAgain ? <Button label="Allow camera" icon={Camera} onPress={() => { void requestPermission().then(value => { if (!value.granted) setError('Camera permission was denied.'); }).catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to request camera permission.')); }} /> : null}
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
        </Card>
      ) : (
        <View style={styles.cameraBox}>
          {active ? <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={finishScan} onMountError={event => { setError(event.message); setActive(false); }} /> : null}
          <View pointerEvents="none" style={styles.overlay}><View style={styles.frame} /><AppText style={styles.frameLabel}>Align the visitor QR inside the frame</AppText></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Toggle flashlight" onPress={() => setTorch(!torch)} style={styles.torch}><Flashlight size={19} color={colors.white} /></Pressable>
        </View>
      )}
      {error ? <Notice tone="red">Camera unavailable: {error} You can still preview the demo QR results below.</Notice> : null}
      {permission?.granted && !active && !error ? <Button label="Scan another code" icon={QrCode} onPress={() => { scanned.current = false; setActive(true); }} /> : null}
      {permission?.granted && error ? <Button label="Try camera again" icon={Camera} variant="outline" onPress={() => { setError(''); scanned.current = false; setActive(true); }} /> : null}
      <Card style={styles.demoCard}>
        <AppText style={styles.demoTitle}>Try demo results</AppText>
        <AppText style={styles.stateCopy}>These shortcuts preview local sample states. They do not scan or authorize a real guest.</AppText>
        <View style={styles.demoActions}>
          {['V-2048', 'UNKNOWN-DEMO', 'expired-demo', 'V-2046'].map(code => <Pressable key={code} accessibilityRole="button" style={styles.demoCode} onPress={() => openDemo(code)}><AppText style={styles.demoCodeText}>{code}</AppText></Pressable>)}
        </View>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  cameraBox: { height: 330, borderRadius: 22, backgroundColor: '#0A1524', overflow: 'hidden', position: 'relative' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 218, height: 218, borderWidth: 2, borderColor: colors.white, borderRadius: 24, backgroundColor: 'transparent' },
  frameLabel: { color: colors.white, backgroundColor: 'rgba(8,18,31,0.62)', overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 15, fontSize: 11 },
  torch: { position: 'absolute', right: 14, top: 14, width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(8,18,31,0.55)', alignItems: 'center', justifyContent: 'center' },
  state: { alignItems: 'center', gap: 12, padding: 24 },
  stateTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateCopy: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  error: { color: colors.red, fontSize: 12 },
  demoCard: { gap: 12 },
  demoTitle: { fontSize: 14, fontWeight: '800' },
  demoActions: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  demoCode: { backgroundColor: colors.blueSoft, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  demoCodeText: { color: colors.blue, fontSize: 10, fontWeight: '700' },
});
