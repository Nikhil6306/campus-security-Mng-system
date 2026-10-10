import { useState } from 'react';
import { router } from 'expo-router';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Field, Notice, Page } from '@/components/security-ui';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const submit = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setError('');
    router.replace('/dashboard');
  };
  return (
    <Page title="Guard sign in" subtitle="Campus Security · Demo interface">
      <View style={styles.mark}><ShieldCheck color={colors.blue} size={30} /><AppText style={styles.brand}>Welcome back</AppText><AppText style={styles.muted}>Sign in to continue your shift.</AppText></View>
      <Card style={styles.form}>
        <Field label="Work email" value={email} onChangeText={setEmail} placeholder="guard@campus.edu" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry={!visible} right={
          <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible(!visible)} hitSlop={10}>
            {visible ? <EyeOff size={19} color={colors.muted} /> : <Eye size={19} color={colors.muted} />}
          </Pressable>
        } />
        {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        <Pressable accessibilityRole="button" onPress={() => router.push('/forgot-password')} style={styles.forgot}><AppText style={styles.link}>Forgot password?</AppText></Pressable>
        <Button label="Continue" icon={LockKeyhole} onPress={submit} />
        <Notice>Frontend demo only. Credentials are not sent to a server and sign-in does not authenticate access.</Notice>
      </Card>
      <Button label="Continue in demo mode" variant="outline" onPress={() => router.replace('/dashboard')} />
    </Page>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', gap: 7, paddingVertical: 15 },
  brand: { fontSize: 22, fontWeight: '800', color: colors.ink },
  muted: { color: colors.muted, fontSize: 13 },
  form: { gap: 16 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 2 },
  link: { color: colors.blue, fontSize: 13, fontWeight: '700' },
  error: { color: colors.red, fontSize: 12 },
});
