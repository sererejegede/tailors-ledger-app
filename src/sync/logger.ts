import { captureError } from '@/lib/sentry';

/**
 * Sync logging, pared down to genuine failures only. The verbose `[sync]` push/pull/
 * envelope tracing (and the rejected-vs-envelope diagnostics) served their purpose while
 * bringing sync up; they were console clutter once it worked, so only error logging remains.
 * Failures are also reported to Sentry (web only, prod only) so a sync error that flashes
 * past the UI still leaves a diagnosable record.
 */
export function syncError(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error('[sync]', ...args);
  const err = args.find((a): a is Error => a instanceof Error);
  captureError(err ?? new Error(args.map(String).join(' ')), { scope: 'sync' });
}
