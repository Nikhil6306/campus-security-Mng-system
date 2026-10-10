import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, BadgeCheck, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, colors, Notice } from '@/components/security-ui';

export default function SplashScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.brand}>
        <View style={styles.logo}><ShieldCheck color={colors.white} size={38} strokeWidth={1.8} /></View>
        <AppText style={styles.kicker}>CAMPUS OPERATIONS</AppText>
        <AppText style={styles.title}>Campus{'\n'}Security</AppText>
        <AppText style={styles.subtitle}>A safer campus starts at every gate.</AppText>
      </View>
      <View style={styles.footer}>
        <View style={styles.verified}><BadgeCheck size={17} color="#85E3BA" /><AppText style={styles.verifiedText}>GUARD ACCESS PORTAL</AppText></View>
        <Button label="Sign in as guard" icon={ArrowRight} onPress={() => router.push('/login')} />
        <Button label="Explore demo mode" variant="secondary" onPress={() => router.replace('/dashboard')} />
        <Notice>Demo mode uses sample data on this device only. No gate access is authorized by this app.</Notice>
        <AppText style={styles.version}>CAMPUS SECURITY · MOBILE</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy, justifyContent: 'space-between', paddingHorizontal: 26, paddingTop: 84, paddingBottom: 28 },
  brand: { alignItems: 'flex-start', paddingTop: 28 },
  logo: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#234878', alignItems: 'center', justifyContent: 'center', marginBottom: 28, borderColor: '#3C6596', borderWidth: 1 },
  kicker: { fontSize: 11, color: '#A9C7ED', letterSpacing: 2.2, fontWeight: '700' },
  title: { color: colors.white, fontSize: 48, lineHeight: 55, fontWeight: '800', marginTop: 12, letterSpacing: -1.6 },
  subtitle: { color: '#C3D0E1', fontSize: 16, marginTop: 14 },
  footer: { gap: 13 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  verifiedText: { color: '#C9D9EB', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  version: { color: '#8CA4C0', fontSize: 9, letterSpacing: 1.6, textAlign: 'center', marginTop: 8 },
});
