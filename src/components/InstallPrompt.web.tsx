import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * PWA install banner (web only). Two platforms, two mechanisms:
 *  - Chromium (Android/desktop) fires `beforeinstallprompt`; we stash it and fire the native
 *    install dialog from the Install button (Chrome no longer auto-shows a banner).
 *  - iOS Safari never fires it and has no programmatic install, so we show the manual
 *    "Share → Add to Home Screen" hint instead.
 * Hidden when already installed (standalone display-mode) or once dismissed (remembered in
 * localStorage). Native builds get the no-op InstallPrompt.tsx.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes standalone on navigator when launched from the home screen.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  // iPadOS 13+ reports as Mac, so also treat touch-capable "Mac" as iOS.
  const iOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in window);
  // Chrome/Firefox on iOS (CriOS/FxiOS) can't Add-to-Home-Screen — only Safari.
  const otherBrowser = /crios|fxios|edgios/i.test(ua);
  return iOS && !otherBrowser;
}

export function InstallPrompt() {
  const insets = useSafeAreaInsets();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isStandalone()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's own mini-infobar; we drive it from the button
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIosHint(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (isIosSafari()) setIosHint(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // private mode / storage disabled — banner just returns next load, which is fine.
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }, [deferred]);

  if (dismissed || isStandalone()) return null;
  if (!deferred && !iosHint) return null;

  return (
    // Absolutely positioned (out of flow) so it never shifts the search/list layout (no CLS);
    // floats above the FAB near the bottom with a drop shadow.
    <View style={[styles.banner, { bottom: insets.bottom + space.lg + 64 }]}>
      <View style={styles.text}>
        <Text style={styles.title}>Install Tailor’s Ledger</Text>
        <Text style={styles.sub}>
          {deferred
            ? 'Add it to your home screen for full-screen, offline use.'
            : 'Tap the Share button, then “Add to Home Screen”.'}
        </Text>
      </View>
      {deferred ? (
        <Pressable style={styles.cta} onPress={install} accessibilityRole="button">
          <Text style={styles.ctaText}>Install</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={dismiss} hitSlop={8} accessibilityLabel="Dismiss install banner">
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
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accentInk },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.default,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
  close: { fontFamily: fonts.body, fontSize: 16, color: colors.muted, paddingHorizontal: 4 },
});
