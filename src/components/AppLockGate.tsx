import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { authenticate } from '@/lib/appLock';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * Gates the app behind device auth when app lock is on (settings). Prompts on launch;
 * a failed/dismissed prompt shows a locked screen with a retry. v1 locks at open only.
 */
export function AppLockGate({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(!enabled);

  const tryUnlock = useCallback(async () => {
    if (await authenticate()) setUnlocked(true);
  }, []);

  useEffect(() => {
    if (enabled && !unlocked) tryUnlock();
  }, [enabled, unlocked, tryUnlock]);

  if (unlocked) return <>{children}</>;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Tailor’s Ledger</Text>
      <Text style={styles.sub}>Locked</Text>
      <Pressable style={styles.button} onPress={tryUnlock}>
        <Text style={styles.buttonText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: space.sm },
  title: { fontFamily: fonts.title, fontSize: fontSizes['2xl'], color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.muted, marginBottom: space.md },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.default,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  buttonText: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: '#fff' },
});
