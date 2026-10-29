import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, BadgeCheck } from 'lucide-react-native';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { AppText, Button, colors } from '@/components/security-ui';
import { restoreGuardSession } from '@/services/api';

export default function SplashScreen() {
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    restoreGuardSession()
      .then((session) => {
        if (session) {
          router.replace('/dashboard');
        } else {
          setCheckingSession(false);
        }
      })
      .catch(() => {
        setCheckingSession(false);
      });
  }, []);

  if (checkingSession) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.blue} />
        <AppText style={[styles.subtitle, { marginTop: 16 }]}>Restoring security session...</AppText>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.brand}>
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/images/university-logo.jpg')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
        <AppText style={styles.kicker}>DEV SANSKRITI VISHWAVIDYALAYA</AppText>
        <AppText style={styles.title}>Campus{'\n'}Security</AppText>
        <AppText style={styles.subtitle}>Gate Operations, Guard Patrol & Verification</AppText>
      </View>
      <View style={styles.footer}>
        <View style={styles.verified}>
          <BadgeCheck size={18} color="#85E3BA" />
          <AppText style={styles.verifiedText}>OFFICIAL SECURITY PORTAL</AppText>
        </View>
        <Button label="Sign In with Guard Credentials" icon={ArrowRight} onPress={() => router.push('/login')} />
        <AppText style={styles.version}>CAMPUS SECURITY MANAGEMENT SYSTEM · HARIDWAR</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy, justifyContent: 'space-between', paddingHorizontal: 26, paddingTop: 74, paddingBottom: 32 },
  brand: { alignItems: 'flex-start', paddingTop: 16 },
  logoWrap: { width: 80, height: 80, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: 24, padding: 4, elevation: 4 },
  logoImg: { width: '100%', height: '100%', borderRadius: 16 },
  kicker: { fontSize: 11, color: '#A9C7ED', letterSpacing: 2, fontWeight: '700' },
  title: { color: colors.white, fontSize: 44, lineHeight: 50, fontWeight: '800', marginTop: 12, letterSpacing: -1.2 },
  subtitle: { color: '#C3D0E1', fontSize: 15, marginTop: 12 },
  footer: { gap: 14 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  verifiedText: { color: '#C9D9EB', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  version: { color: '#8CA4C0', fontSize: 9, letterSpacing: 1.4, textAlign: 'center', marginTop: 10 },
});
