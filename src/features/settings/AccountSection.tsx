import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { useSync } from '@/sync';
import { getRelativeTime } from '@/lib/time';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import GoogleIcon from '@/assets/icons/google.svg';

/**
 * Account & sync settings. Sync is opt-in: signed out, the app is fully usable offline.
 * Sign-in is passwordless (magic link) — enter an email, tap the link in it, and the
 * session persists + auto-refreshes thereafter. Signed in, it shows the last-synced time
 * and a manual "Sync now" (sync also runs automatically in the background — Stage D).
 */
export function AccountSection() {
  const { session, configured, signInWithGoogle, signInWithMagicLink, signOut } = useAuth();
  const { syncing, lastSyncedAt, lastError, rejected, syncNow } = useSync();
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
      <Text style={styles.section}>Sign in to backup your data.</Text>

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

          <Text style={styles.syncStatus}>
            {syncing
              ? 'Syncing…'
              : lastSyncedAt
                ? `Last synced ${getRelativeTime(lastSyncedAt)}`
                : 'Not synced yet'}
          </Text>
          {rejected.length > 0 ? (
            <Text style={styles.warn}>
              {rejected.length} change{rejected.length === 1 ? '' : 's'} couldn’t sync.
            </Text>
          ) : null}
          {lastError ? <Text style={styles.error}>Sync failed: {lastError}</Text> : null}

          <View style={styles.row}>
            <Pressable
              style={[styles.secondaryBtn, syncing && styles.btnDisabled]}
              disabled={syncing}
              onPress={syncNow}
            >
              <Text style={styles.secondaryText}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={signOut}>
              <Text style={styles.secondaryText}>Sign out</Text>
            </Pressable>
          </View>
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
          <Pressable style={[styles.primaryBtn, busy && styles.btnDisabled]} disabled={busy} onPress={google}>
            <Text style={styles.primaryText}>Continue with Google</Text>
            <GoogleIcon />
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
          <View style={styles.row}>
            <Pressable style={[styles.secondaryBtn, busy && styles.btnDisabled]} disabled={busy} onPress={send}>
              <Text style={styles.secondaryText}>{busy ? 'Working…' : 'Send'}</Text>
            </Pressable>
          </View>
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
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  syncStatus: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: space.xs },
  warn: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
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
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.default,
    paddingVertical: space.md,
    paddingInline: space.xl,
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, color: colors.accent },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.default,
    paddingVertical: space.md,
    paddingInline: space.xl,
    alignItems: 'center',
  },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accent },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent },
});
