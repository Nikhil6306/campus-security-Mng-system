import { useState } from 'react';
import { MailCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, colors, Field, Notice, Page } from '@/components/security-ui';
import { requestPasswordReset } from '@/services/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid work email address to continue.');
      setMessage('');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await requestPasswordReset(email);
      if (res.ok) {
        setMessage(res.message || 'Password reset link sent to your registered email address.');
      } else {
        setError(res.error || 'Failed to request password reset. Please try again.');
      }
    } catch (err) {
      setError('Network failure while submitting request. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title="Forgot Password" subtitle="Guard Account Support">
      <View style={styles.intro}>
        <View style={styles.icon}>
          <MailCheck color={colors.blue} size={24} />
        </View>
        <AppText style={styles.title}>Reset Your Password</AppText>
        <AppText style={styles.copy}>
          Enter your registered university email to receive a secure password reset link.
        </AppText>
      </View>
      <Card style={styles.card}>
        <Field
          label="Registered Work Email"
          value={email}
          onChangeText={setEmail}
          placeholder="officer@dsvv.edu.in"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        {message ? <Notice tone="green">{message}</Notice> : null}
        <Button label={loading ? 'Sending Request...' : 'Request Reset Link'} onPress={submit} disabled={loading} />
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
