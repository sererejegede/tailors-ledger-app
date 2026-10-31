/**
 * All timestamps in this app are integer epoch milliseconds, UTC (contract §3).
 * Centralized so tests can mock a clock and so the meaning is unambiguous everywhere.
 */
export function nowMs(): number {
  return Date.now();
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "30 Oct". Spelled out by hand so a receipt reads the same on every phone. */
export function formatDayMonth(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "30 Oct 2026". */
export function formatDate(ms: number): string {
  return `${formatDayMonth(ms)} ${new Date(ms).getFullYear()}`;
}

/** "Sat 14 Nov". */
export function formatWeekday(ms: number): string {
  return `${WEEKDAYS[new Date(ms).getDay()]} ${formatDayMonth(ms)}`;
}

/** The same time of day, `days` later. Calendar-based, so it survives clock changes. */
export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}


const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Human-friendly relative time: "just now", "5 minutes ago", "2 hours ago", "yesterday",
 * "3 days ago", "2 weeks ago", then a calendar date for anything older ("12 May", or
 * "12 May 2025" if it's a different year). Accepts a Date or epoch-ms number.
 */
export function getRelativeTime(timestamp: Date | number): string {
  const time = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
  const diff = nowMs() - time;

  if (diff < MINUTE) return 'just now';

  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  }

  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(diff / DAY);
  if (days === 1) return 'yesterday';
  if (diff < WEEK) return `${days} days ago`;

  if (diff < 5 * WEEK) {
    const weeks = Math.floor(diff / WEEK);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  // Older than ~a month → a calendar date (with the year only if it's not this year).
  const date = new Date(time);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(
    undefined,
    sameYear
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  );
}
