import React, { Component, type ReactNode, useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, colors } from '@/components/security-ui';

// Keep the splash screen visible while assets/fonts load
SplashScreen.preventAutoHideAsync().catch(() => {});

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CSMS Guard Mobile] Uncaught Application Error:', error, errorInfo);
    SplashScreen.hideAsync().catch(() => {});
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <StatusBar style="dark" />
          <AppText style={styles.errorTitle}>Security Portal Error</AppText>
          <AppText style={styles.errorMessage}>
            {this.state.error?.message || 'An unexpected error occurred while starting the application.'}
          </AppText>
          <Button label="Reload Portal" onPress={this.handleRestart} />
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  useEffect(() => {
    // Guarantees splash screen is dismissed within 600ms on cold start
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  return (
    <RootErrorBoundary>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
});
