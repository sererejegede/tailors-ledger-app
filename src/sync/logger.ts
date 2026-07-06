/**
 * Sync logging, pared down to genuine failures only. The verbose `[sync]` push/pull/
 * envelope tracing (and the rejected-vs-envelope diagnostics) served their purpose while
 * bringing sync up; they were console clutter once it worked, so only error logging remains.
 */
export function syncError(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error('[sync]', ...args);
}
