/**
 * All timestamps in this app are integer epoch milliseconds, UTC (contract §3).
 * Centralized so tests can mock a clock and so the meaning is unambiguous everywhere.
 */
export function nowMs(): number {
  return Date.now();
}
