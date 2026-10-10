import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DemoProvider } from '@/state/demo-store';
import { colors } from '@/components/security-ui';

export default function RootLayout() {
  return (
    <DemoProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </DemoProvider>
  );
}
