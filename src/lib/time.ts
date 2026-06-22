/**
 * All timestamps in this app are integer epoch milliseconds, UTC (contract §3).
 * Centralized so tests can mock a clock and so the meaning is unambiguous everywhere.
 */
export function nowMs(): number {
  return Date.now();
}


export function getRelativeTime(timestamp: Date): string {
  const now = nowMs();
  const diff = now - timestamp.getTime();
  if (diff < 60000) {
    return 'just now';
  }
  return new Date(timestamp).toLocaleTimeString();
}
