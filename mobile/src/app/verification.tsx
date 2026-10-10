import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, CircleX, Clock3, ShieldAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Notice, Page, Pill } from '@/components/security-ui';

type ResultKind = 'valid' | 'invalid' | 'expired' | 'used';
const resultCopy: Record<ResultKind, { title: string; detail: string; tone: 'green' | 'red' | 'amber' | 'gray'; label: string; icon: typeof BadgeCheck; color: string }> = {
  valid: { title: 'Demo pass found', detail: 'A matching visitor exists in this device’s sample data. This result is not proof of identity or permission to enter.', tone: 'green', label: 'SAMPLE MATCH', icon: BadgeCheck, color: colors.green },
  invalid: { title: 'No matching pass', detail: 'This code was not found in the local sample visitor list. Check the code and try again.', tone: 'red', label: 'NOT FOUND', icon: CircleX, color: colors.red },
  expired: { title: 'Sample pass expired', detail: 'This demo code represents an expired pass. No live expiry or visitor service is connected.', tone: 'amber', label: 'EXPIRED DEMO', icon: Clock3, color: colors.amber },
  used: { title: 'Sample pass already used', detail: 'This visitor’s sample record is checked out. Do not use demo results to decide campus access.', tone: 'gray', label: 'ALREADY USED', icon: ShieldAlert, color: colors.muted },
};

export default function VerificationScreen() {
  const params = useLocalSearchParams<{ status?: string; visitor?: string; code?: string }>();
  const status: ResultKind = params.status === 'valid' || params.status === 'expired' || params.status === 'used' ? params.status : 'invalid';
  const result = resultCopy[status];
  const Icon = result.icon;
  return (
    <Page title="QR verification" subtitle="Local demo result">
      <Notice>Demo-only verification · not real identity verification and not authorization to enter campus.</Notice>
      <Card style={styles.resultCard}>
        <View style={[styles.resultIcon, { backgroundColor: status === 'valid' ? colors.greenSoft : status === 'expired' ? colors.amberSoft : status === 'invalid' ? colors.redSoft : '#EFF2F6' }]}><Icon size={36} color={result.color} /></View>
        <Pill label={result.label} tone={result.tone} />
        <AppText style={styles.title}>{result.title}</AppText>
        <AppText style={styles.detail}>{result.detail}</AppText>
      </Card>
      <Card style={styles.codeCard}>
        <AppText style={styles.metaLabel}>SCANNED CODE</AppText>
        <AppText style={styles.code}>{params.code || 'No code provided'}</AppText>
        {status === 'valid' && params.visitor ? <><AppText style={styles.metaLabel}>SAMPLE VISITOR</AppText><AppText style={styles.visitor}>{params.visitor}</AppText></> : null}
      </Card>
      {status === 'valid' ? <Button label="Go to check-in form" onPress={() => router.push('/check-in')} /> : null}
      <Button label="Scan another pass" onPress={() => router.replace('/scan')} />
    </Page>
  );
}

const styles = StyleSheet.create({
  resultCard: { alignItems: 'center', gap: 14, paddingVertical: 27, paddingHorizontal: 20 },
  resultIcon: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '800', textAlign: 'center' },
  detail: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  codeCard: { gap: 8 },
  metaLabel: { fontSize: 9, letterSpacing: 1.2, color: colors.muted, fontWeight: '800', marginTop: 4 },
  code: { fontSize: 17, fontWeight: '800', color: colors.ink },
  visitor: { fontSize: 14, fontWeight: '700' },
});
