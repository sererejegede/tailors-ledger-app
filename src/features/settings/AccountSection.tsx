import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * Account & sync settings. Sync is opt-in: signed out, the app is fully usable offline.
 * Sign-in is passwordless (magic link) — enter an email, tap the link in it, and the
 * session persists + auto-refreshes thereafter. (Sync status / "Sync now" land in Stage D.)
 */
export function AccountSection() {
  const { session, configured, signInWithGoogle, signInWithMagicLink, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    setError(undefined);
    const res = await signInWithGoogle();
    setBusy(false);
    if (res.error) setError(res.error);
  };

  const send = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(undefined);
    const res = await signInWithMagicLink(email);
    setBusy(false);
    if (res.error) setError(res.error);
    else setSent(true);
  };

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.section}>Account &amp; sync</Text>

      {!configured ? (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Sync isn’t set up on this build yet. Your measurements are saved locally and stay
            fully usable offline.
          </Text>
        </View>
      ) : session ? (
        <View style={styles.card}>
          <Text style={styles.hint}>Signed in</Text>
          <Text style={styles.email}>{session.user.email}</Text>
          <Pressable style={styles.secondaryBtn} onPress={signOut}>
            <Text style={styles.secondaryText}>Sign out</Text>
          </Pressable>
        </View>
      ) : sent ? (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Check <Text style={styles.email}>{email.trim()}</Text> for a sign-in link, then open it
            on this device.
          </Text>
          <Pressable onPress={() => setSent(false)}>
            <Text style={styles.link}>Use a different email</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.hint}>Sign in to sync across devices.</Text>

          <Pressable style={[styles.primaryBtn, busy && styles.btnDisabled]} disabled={busy} onPress={google}>
            <Text style={styles.primaryText}>Continue with Google</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>or email link</Text>
            <View style={styles.line} />
          </View>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.secondaryBtn, busy && styles.btnDisabled]} disabled={busy} onPress={send}>
            <Text style={styles.secondaryText}>{busy ? 'Working…' : 'Send magic link'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, marginTop: space.md },
  sectionContainer: { paddingHorizontal: space.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: space.sm,
    marginTop: space.xs,
  },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, lineHeight: 20 },
  email: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.default,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.xs },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { fontFamily: fonts.body, fontSize: 12, color: colors.faint },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.default,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.default,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent },
});
