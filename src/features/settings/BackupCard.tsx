import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { useSync } from '@/sync';
import { Alert } from '@/lib/alert';
import { cleanupMessage, type CleanupPlan } from '@/sync/cleanup';
import { getRelativeTime } from '@/lib/time';
import { backupStatus, type BackupTone } from '@/lib/settingsSummary';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { buttonLabel, fonts } from '@/theme/typography';
import { BottomSheet } from '@/components/jobs/BottomSheet';
import { Button, TextAction } from '@/components/ui';
import GoogleIcon from '@/assets/icons/google.svg';

const DOT: Record<BackupTone, string> = { ok: colors.ok, warn: colors.warn, off: colors.faint };

/**
 * S11's backup card: a dot, "Backed up 2 min ago" and the account, with Sign out (or Sign
 * in). Signed in, tapping the card backs up now; it also runs on its own in the
 * background. Anything stuck shows under the card. Sign-in (Google or an email link)
 * opens in a sheet. Signed out, the app is fully usable offline.
 */
export function BackupCard() {
  const { session, configured, signOut } = useAuth();
  const { syncing, lastSyncedAt, lastError, rejected, blockedBy, syncNow, backUpBeforeSignOut, cleanup, removeCleanup } =
    useSync();
  const [signingOut, setSigningOut] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const email = session?.user.email ?? null;

  // Signing in closes the sheet.
  useEffect(() => {
    if (session) setSigningIn(false);
  }, [session]);

  const status = backupStatus(
    {
      configured,
      email: session ? (email ?? 'Signed in') : null,
      syncing: syncing || signingOut,
      lastSyncedAt,
      lastError,
      rejected: rejected.length,
      blocked: !!blockedBy,
    },
    getRelativeTime,
  );

  // Rows that can never sync to this account (data model §1d): confirm, then remove them
  // from this phone. Shown here in Settings only, never over a measuring session.
  const confirmCleanup = (plan: CleanupPlan, after?: { removed?: () => void; kept?: () => void }) => {
    Alert.alert('Remove data from this phone', cleanupMessage(plan), [
      { text: 'Keep it', style: 'cancel', onPress: after?.kept },
      {
        text: 'Remove from this phone',
        style: 'destructive',
        onPress: async () => {
          const { stale } = await removeCleanup(plan);
          if (stale) {
            Alert.alert('Nothing removed', 'This data changed since it was shown. Sync again to review it.');
          } else {
            after?.removed?.();
          }
        },
      },
    ]);
  };

  // Offer it once per set of rows when a sync finds them; "Review" reopens it.
  const offeredRef = useRef(new Set<string>());
  useEffect(() => {
    if (!cleanup || offeredRef.current.has(cleanup.signature)) return;
    offeredRef.current.add(cleanup.signature);
    confirmCleanup(cleanup);
  }, [cleanup?.signature]);

  // Back up this account's changes before signing out, so the next account to sign in
  // starts clean. Only if something still can't be backed up do we ask.
  const confirmSignOut = async () => {
    setSigningOut(true);
    const { unsynced, error: backUpError, cleanup: plan } = await backUpBeforeSignOut();
    setSigningOut(false);
    if (unsynced === 0) {
      await signOut();
      return;
    }
    const askSignOutAnyway = () => signOutAnyway(unsynced, backUpError);
    if (plan) {
      offeredRef.current.add(plan.signature);
      confirmCleanup(plan, { removed: () => void confirmSignOut(), kept: askSignOutAnyway });
      return;
    }
    askSignOutAnyway();
  };

  const signOutAnyway = (unsynced: number, backUpError: string | null) => {
    const changes = `${unsynced} change${unsynced === 1 ? '' : 's'}`;
    Alert.alert(
      'Sign out',
      `${changes} on this phone couldn’t be backed up${backUpError ? ` (${backUpError})` : ''}. ` +
        'Stay signed in and try again when you’re online. If you sign out anyway, they stay on ' +
        'this phone, and another account can’t sync here until they’re backed up.',
      [
        { text: 'Stay signed in', style: 'cancel' },
        { text: 'Sign out anyway', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  };

  const busy = syncing || signingOut;

  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && session ? styles.pressed : null]}
        onPress={session && !busy ? syncNow : undefined}
        disabled={!session || busy}
        accessibilityRole={session ? 'button' : undefined}
        accessibilityHint={session ? 'Backs up now' : undefined}
      >
        <View style={[styles.dot, { backgroundColor: DOT[status.tone] }]} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {signingOut ? 'Backing up before signing out…' : status.title}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {status.detail}
          </Text>
        </View>
        {!configured ? null : session ? (
          <TextAction label="Sign out" onPress={() => void confirmSignOut()} />
        ) : (
          <TextAction label="Sign in" onPress={() => setSigningIn(true)} />
        )}
      </Pressable>

      {session && rejected.length > 0 ? (
        <Text style={styles.warn}>
          {rejected.length} change{rejected.length === 1 ? '' : 's'} couldn’t back up.
          {cleanup ? (
            <Text style={styles.link} onPress={() => confirmCleanup(cleanup)}>
              {' '}Review
            </Text>
          ) : null}
        </Text>
      ) : null}
      {session && lastError ? <Text style={styles.error}>Backup failed: {lastError}</Text> : null}
      {session && blockedBy ? (
        <Text style={styles.warn}>
          Backup is paused. This phone has {blockedBy.unsynced} change{blockedBy.unsynced === 1 ? '' : 's'} from{' '}
          {blockedBy.otherAccount ?? 'another account'} that aren’t backed up yet. Sign in as that account and back
          up first, then switch back.
        </Text>
      ) : null}

      {signingIn ? <SignInSheet onClose={() => setSigningIn(false)} /> : null}
    </View>
  );
}

/** Sign in with Google, or with a link sent by email. Mount it to open it. */
function SignInSheet({ onClose }: { onClose: () => void }) {
  const { signInWithGoogle, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
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
    <BottomSheet onClose={onClose}>
      <Text style={styles.sheetTitle} accessibilityRole="header">
        Sign in to back up
      </Text>
      {sent ? (
        <>
          <Text style={styles.sheetText}>
            Check <Text style={styles.strong}>{email.trim()}</Text> for a sign-in link, then open it on this phone.
          </Text>
          <TextAction label="Use a different email" onPress={() => setSent(false)} />
        </>
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [styles.google, (busy || pressed) && styles.pressed]}
            disabled={busy}
            onPress={google}
            accessibilityRole="button"
          >
            <GoogleIcon />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>
          <View style={styles.or}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or an email link</Text>
            <View style={styles.orLine} />
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
            returnKeyType="send"
            onSubmitEditing={send}
            accessibilityLabel="Email"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button
              kind="primary"
              label={busy ? 'Working…' : 'Send link'}
              onPress={send}
              disabled={busy || !email.trim()}
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.6 },
  dot: { width: 10, height: 10, borderRadius: radius.round },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  warn: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.text, marginTop: space.sm },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.danger, marginTop: space.sm },
  link: { fontFamily: fonts.semibold, color: colors.text, textDecorationLine: 'underline' },
  sheetTitle: { fontFamily: fonts.titleSemi, fontSize: 22, color: colors.text },
  sheetText: { fontFamily: fonts.body, fontSize: fontSizes.base, lineHeight: 22, color: colors.text },
  strong: { fontFamily: fonts.semibold },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
  },
  googleText: { fontFamily: fonts.bold, ...buttonLabel(fontSizes.base), color: colors.text },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.muted },
  input: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  actions: { flexDirection: 'row' },
});
