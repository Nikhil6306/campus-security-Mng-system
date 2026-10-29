import { useState } from 'react';
import { router } from 'expo-router';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Field, Notice, Page } from '@/components/security-ui';
import { loginGuard } from '@/services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('security@dsvv.edu.in');
  const [password, setPassword] = useState('Security@123');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid work email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await loginGuard(email, password);
      if (result.success) {
        router.replace('/dashboard');
      } else {
        setError(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Server connection failed. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title="Guard Sign In" subtitle="Campus Security Portal">
      <View style={styles.mark}>
        <Image
          source={require('../../assets/images/university-logo.jpg')}
          style={styles.logo}
          resizeMode="contain"
          alt="Dev Sanskriti Vishwavidyalaya Logo"
        />
        <AppText style={styles.brand}>Duty Officer Sign In</AppText>
        <AppText style={styles.muted}>Dev Sanskriti Vishwavidyalaya · Security Portal</AppText>
      </View>
      <Card style={styles.form}>
        <Field
          label="Work Email"
          value={email}
          onChangeText={setEmail}
          placeholder="guard@campus.edu"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your security password"
          secureTextEntry={!visible}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visible ? 'Hide password' : 'Show password'}
              onPress={() => setVisible(!visible)}
              hitSlop={10}
            >
              {visible ? <EyeOff size={19} color={colors.muted} /> : <Eye size={19} color={colors.muted} />}
            </Pressable>
          }
        />
        {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        <Pressable accessibilityRole="button" onPress={() => router.push('/forgot-password')} style={styles.forgot}>
          <AppText style={styles.link}>Forgot password?</AppText>
        </Pressable>
        <Button
          label={loading ? 'Verifying Credentials...' : 'Sign In as Guard'}
          icon={LockKeyhole}
          onPress={() => void submit()}
        />
        <Notice>Security Gate System: Authorized security personnel and gate operators only.</Notice>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', gap: 7, paddingVertical: 15 },
  logo: { width: 72, height: 72, marginBottom: 4 },
  brand: { fontSize: 22, fontWeight: '800', color: colors.ink },
  muted: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  form: { gap: 16 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 2 },
  link: { color: colors.blue, fontSize: 13, fontWeight: '700' },
  error: { color: colors.red, fontSize: 12 },
});
