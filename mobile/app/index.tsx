import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, BadgeCheck, RefreshCw, Shield, WifiOff } from 'lucide-react-native';
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText, Button, colors } from '@/components/security-ui';
import { restoreGuardSession } from '@/services/api';

type AppPhase = 'splash' | 'portal' | 'error';

export default function SecuritySplashScreen() {
  const [phase, setPhase] = useState<AppPhase>('splash');
  const [statusMessage, setStatusMessage] = useState('Initializing Security Engine...');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Smooth entrance animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Trigger smooth entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Hide native splash screen quickly so the custom UI takes over smoothly
    const nativeSplashDismissTimer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 200);

    // 3. Initialize offline persistence and restore guard session
    let isMounted = true;
    const initTimer = setTimeout(async () => {
      try {
        setStatusMessage('Verifying Duty Session...');
        const session = await restoreGuardSession();
        
        if (!isMounted) return;

        if (session) {
          // Guard is authenticated; transition directly to Guard Dashboard
          router.replace('/dashboard');
        } else {
          // No active session; smoothly reveal the Duty Officer Portal
          setPhase('portal');
          Animated.timing(contentFadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }).start();
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('[CSMS Security] Session restore warning:', err);
        // Fallback to portal in offline mode rather than blocking the guard
        setPhase('portal');
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      }
    }, 1100);

    return () => {
      isMounted = false;
      clearTimeout(nativeSplashDismissTimer);
      clearTimeout(initTimer);
    };
  }, []);

  const handleRetry = async () => {
    setPhase('splash');
    setStatusMessage('Reconnecting...');
    try {
      const session = await restoreGuardSession();
      if (session) {
        router.replace('/dashboard');
      } else {
        setPhase('portal');
      }
    } catch {
      setPhase('portal');
    }
  };

  // Phase 1: Premium Splash Screen
  if (phase === 'splash') {
    return (
      <View style={styles.splashScreen}>
        <StatusBar style="light" />
        <Animated.View
          style={[
            styles.splashContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Centered Professional Security Emblem */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/security-logo.png')}
              style={styles.securityLogo}
              resizeMode="contain"
            />
          </View>

          {/* App Title */}
          <AppText style={styles.splashTitle}>SECURITY</AppText>
          
          {/* Elegant Gold Accent */}
          <View style={styles.goldAccent} />

          {/* Subtitle */}
          <AppText style={styles.splashSubtitle}>Campus Security Management</AppText>
          <AppText style={styles.splashInstitution}>DEV SANSKRITI VISHWAVIDYALAYA</AppText>

          {/* Subtle Loading Indicator */}
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color="#F59E0B" />
            <AppText style={styles.statusText}>{statusMessage}</AppText>
          </View>
        </Animated.View>

        {/* Minimal Institutional Footer */}
        <View style={styles.splashFooter}>
          <AppText style={styles.footerVersion}>HARIDWAR GATE OPERATIONS · OFFLINE FIRST</AppText>
        </View>
      </View>
    );
  }

  // Phase 2: Error Screen (if critical failure occurs)
  if (phase === 'error') {
    return (
      <View style={[styles.splashScreen, { justifyContent: 'center', paddingHorizontal: 24 }]}>
        <StatusBar style="light" />
        <View style={styles.errorCard}>
          <WifiOff size={42} color="#F59E0B" />
          <AppText style={styles.errorTitle}>Initialization Warning</AppText>
          <AppText style={styles.errorDesc}>
            {errorMessage || 'Unable to establish live connection. You can proceed in Offline Gate Mode.'}
          </AppText>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <RefreshCw size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <AppText style={styles.retryButtonText}>Retry Initialization</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: '#1E293B', marginTop: 10 }]}
            onPress={() => setPhase('portal')}
          >
            <AppText style={styles.retryButtonText}>Continue to Gate Portal</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Phase 3: Gate Operations Welcome & Sign-In Screen
  return (
    <View style={styles.portalScreen}>
      <StatusBar style="light" />
      <Animated.View style={[styles.portalContainer, { opacity: contentFadeAnim }]}>
        <View style={styles.portalHeader}>
          <View style={styles.portalLogoWrap}>
            <Image
              source={require('../assets/images/security-logo.png')}
              style={styles.portalLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.institutionTag}>
            <Shield size={13} color="#F59E0B" />
            <AppText style={styles.kicker}>DEV SANSKRITI VISHWAVIDYALAYA</AppText>
          </View>
          <AppText style={styles.mainTitle}>Security</AppText>
          <View style={styles.goldDivider} />
          <AppText style={styles.tagline}>
            Gate Operations, Guard Patrol & Cryptographic Pass Verification
          </AppText>
        </View>

        <View style={styles.portalFooter}>
          <View style={styles.badgeRow}>
            <View style={styles.verifiedBadge}>
              <BadgeCheck size={16} color="#10B981" />
              <AppText style={styles.verifiedText}>OFFICIAL SECURITY PORTAL</AppText>
            </View>
            <View style={styles.offlinePill}>
              <AppText style={styles.offlinePillText}>Offline Mode Supported</AppText>
            </View>
          </View>

          <View style={{ gap: 10, width: '100%' }}>
            <Button
              label="Sign In with Guard Credentials"
              icon={ArrowRight}
              onPress={() => router.push('/login')}
            />
            <Button
              label="Register New Guard Account"
              variant="secondary"
              onPress={() => router.push('/register' as any)}
            />
          </View>
          <AppText style={styles.copyright}>
            CAMPUS SECURITY MANAGEMENT SYSTEM · HARIDWAR
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Splash Screen Styles
  splashScreen: {
    flex: 1,
    backgroundColor: '#0A192F',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 56,
  },
  splashContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: 'rgba(17, 34, 64, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    elevation: 8,
  },
  securityLogo: {
    width: 82,
    height: 82,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 6,
  },
  goldAccent: {
    width: 44,
    height: 3,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
    marginVertical: 14,
  },
  splashSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  splashInstitution: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 2,
    marginTop: 8,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(17, 34, 64, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  statusText: {
    fontSize: 12,
    color: '#E2E8F0',
    marginLeft: 10,
    fontWeight: '500',
  },
  splashFooter: {
    alignItems: 'center',
  },
  footerVersion: {
    fontSize: 9,
    letterSpacing: 1.6,
    color: '#64748B',
    fontWeight: '600',
  },

  // Portal Screen Styles
  portalScreen: {
    flex: 1,
    backgroundColor: '#0A192F',
  },
  portalContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    paddingTop: 68,
    paddingBottom: 32,
  },
  portalHeader: {
    alignItems: 'flex-start',
    paddingTop: 12,
  },
  portalLogoWrap: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(17, 34, 64, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    elevation: 6,
  },
  portalLogo: {
    width: 58,
    height: 58,
  },
  institutionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  kicker: {
    fontSize: 11,
    color: '#F59E0B',
    letterSpacing: 1.8,
    fontWeight: '700',
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1,
  },
  goldDivider: {
    width: 38,
    height: 3,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
    marginVertical: 12,
  },
  tagline: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  portalFooter: {
    gap: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedText: {
    color: '#E2E8F0',
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  offlinePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  offlinePillText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '600',
  },
  copyright: {
    color: '#64748B',
    fontSize: 9,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginTop: 8,
  },

  // Error Card Styles
  errorCard: {
    backgroundColor: '#112240',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  errorDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
