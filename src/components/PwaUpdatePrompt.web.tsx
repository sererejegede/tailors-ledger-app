import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * PWA "update available" prompt (web only). Our service worker no longer auto-activates a new
 * version — it waits — so here we detect the waiting worker, show a toast, and on "Refresh"
 * tell it to activate (postMessage SKIP_WAITING) then reload once it takes control. Doing it
 * on the user's tap avoids a surprise reload mid-measurement (which would drop an unsaved
 * in-memory draft). Native gets the no-op PwaUpdatePrompt.tsx.
 */
export function PwaUpdatePrompt() {
  const insets = useSafeAreaInsets();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    let reg: ServiceWorkerRegistration | undefined;

    // A worker only counts as an "update" once it's installed AND there's already a
    // controller (i.e. not the very first install).
    const track = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const check = () => {
        if (!cancelled && worker.state === 'installed' && navigator.serviceWorker.controller) {
          setWaiting(worker);
          setDismissed(false);
        }
      };
      check();
      worker.addEventListener('statechange', check);
    };

    navigator.serviceWorker.getRegistration().then((r) => {
      if (!r || cancelled) return;
      reg = r;
      if (r.waiting) track(r.waiting); // a new version downloaded while the app was closed
      r.addEventListener('updatefound', () => track(r.installing));
      r.update().catch(() => {}); // proactively check on mount
    });

    // Re-check for a new version whenever the app regains focus.
    const onFocus = () => reg?.update().catch(() => {});
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const refresh = useCallback(() => {
    if (!waiting) return;
    // Reload once the newly-activated worker takes control. Attaching the listener only here
    // (on the user's tap) avoids reloading on the first-install controller change.
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true },
    );
    waiting.postMessage('SKIP_WAITING');
  }, [waiting]);

  if (!waiting || dismissed) return null;

  return (
    // Same slot as the install banner (bottom, above the FAB); higher zIndex so it wins if
    // both are ever active at once.
    <View style={[styles.banner, { bottom: insets.bottom + space.lg + 64 }]}>
      <View style={styles.text}>
        <Text style={styles.title}>Update available</Text>
        <Text style={styles.sub}>A new version of Tailor’s Ledger is ready.</Text>
      </View>
      <Pressable style={styles.cta} onPress={refresh} accessibilityRole="button">
        <Text style={styles.ctaText}>Refresh</Text>
      </Pressable>
      <Pressable onPress={() => setDismissed(true)} hitSlop={8} accessibilityLabel="Dismiss update notice">
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 2,
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.accentInk },
  sub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.default,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: '#fff' },
  close: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.muted, paddingHorizontal: 4 },
});
