import { useState } from 'react';
import { MailCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Field, Notice, Page } from '@/components/security-ui';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address to continue.');
      setMessage('');
      return;
    }
    setError('');
    setMessage('Demo request complete. Password recovery is not connected yet.');
  };
  return (
    <Page title="Forgot password" subtitle="Account support">
      <View style={styles.intro}><View style={styles.icon}><MailCheck color={colors.blue} size={24} /></View><AppText style={styles.title}>Reset your password</AppText><AppText style={styles.copy}>Enter your work email and we’ll show a demo confirmation.</AppText></View>
      <Card style={styles.card}>
        <Field label="Work email" value={email} onChangeText={setEmail} placeholder="name@campus.edu" keyboardType="email-address" autoCapitalize="none" />
        {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        {message ? <Notice tone="green">{message}</Notice> : null}
        <Button label="Request reset link" onPress={submit} />
        <Notice>Nothing is emailed in this frontend-only demo.</Notice>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: 8, paddingVertical: 15 },
  icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  title: { color: colors.ink, fontWeight: '800', fontSize: 21 },
  copy: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  card: { gap: 15 },
  error: { color: colors.red, fontSize: 12 },
});
