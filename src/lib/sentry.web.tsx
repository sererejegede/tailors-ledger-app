import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react';
import Constants from 'expo-constants';
import { config } from '@/lib/config';
import { deepRedact } from '@/lib/redact';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * Web-only Sentry error reporting. Errors only — no performance/tracing/replay — and only
 * active OUTSIDE development and when a DSN is configured (app.json → extra.sentryDsn), so
 * dev never reports. Every outgoing event is scrubbed (tokens/emails/response bodies) by
 * `beforeSend`. Native gets the no-op sentry.tsx.
 */

let enabled = false;

export function initSentry(): void {
  if (__DEV__ || enabled || !config.sentryDsn) return;
  enabled = true;
  Sentry.init({
    dsn: config.sentryDsn,
    release: Constants.expoConfig?.version,
    environment:
      typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? 'local'
        : 'production',
    tracesSampleRate: 0, // errors only
    sendDefaultPii: false,
    beforeSend(event) {
      const headers = event.request?.headers;
      if (headers) {
        delete headers.Authorization;
        delete headers.authorization;
      }
      return deepRedact(event);
    },
  });
}

/** Report a handled error with optional context (no-op until initialized). */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  const err = error instanceof Error ? error : new Error(String(error));
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <Sentry.ErrorBoundary fallback={<CrashFallback />}>{children}</Sentry.ErrorBoundary>;
}

function CrashFallback() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.sub}>The app hit an unexpected error. It has been reported.</Text>
      <Pressable style={styles.button} onPress={() => window.location.reload()}>
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: space.sm,
    padding: space.xl,
  },
  title: { fontFamily: fonts.title, fontSize: fontSizes['2xl'], color: colors.text },
  sub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: space.md,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.default,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  buttonText: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: '#fff' },
});
