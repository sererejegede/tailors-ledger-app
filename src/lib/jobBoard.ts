import type { JobTotals } from '@/repositories/jobs';

/**
 * How jobs are sorted and summed for the Jobs tab and the Clients home tiles. Pure, so it
 * can be tested without a database. Everything is worked out from the job's items,
 * payments and `collect_on`; nothing is stored (no database change for the redesign).
 */

export type JobRow = JobTotals & {
  jobId: string;
  clientId: string;
  clientName: string;
  label: string;
  itemCount: number;
  currency: string;
  /** The collection date, shown as "Due …". */
  collectOn: number | null;
  createdAt: number;
};

/**
 * Still owed while the balance is above 0, otherwise Paid. A job with nothing priced and
 * nothing paid is neither yet: it has no price.
 */
export type JobState = 'owed' | 'paid' | 'unpriced';

export function jobState(t: JobTotals): JobState {
  if (t.balanceMinor > 0) return 'owed';
  if (t.totalMinor === 0 && t.paidMinor === 0) return 'unpriced';
  return 'paid';
}

export type JobFilter = 'all' | 'owed' | 'paid';

export function filterJobs<T extends JobTotals>(rows: T[], filter: JobFilter): T[] {
  if (filter === 'all') return rows;
  return rows.filter((r) => jobState(r) === filter);
}

const DAY_COUNT = 7;

/** Midnight at the start of the day `ms` falls on, on this phone's clock. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The end of "this week": midnight after the 7th day, counting today as the first. */
export function weekEnd(now: number): number {
  const d = new Date(startOfDay(now));
  d.setDate(d.getDate() + DAY_COUNT);
  return d.getTime();
}

export type DueGroup = 'overdue' | 'week' | 'later' | 'none' | 'earlier';

/**
 * Which section a job sits in. "Due this week" is today and the next six days. A date
 * that has passed is Overdue while money is still owed, otherwise Earlier.
 */
export function dueGroup(row: Pick<JobRow, 'collectOn'> & JobTotals, now: number): DueGroup {
  if (row.collectOn == null) return 'none';
  if (row.collectOn < startOfDay(now)) return jobState(row) === 'owed' ? 'overdue' : 'earlier';
  return row.collectOn < weekEnd(now) ? 'week' : 'later';
}

export const DUE_GROUP_TITLES: Record<DueGroup, string> = {
  overdue: 'Overdue',
  week: 'Due this week',
  later: 'Later',
  none: 'No date yet',
  earlier: 'Earlier',
};

const GROUP_ORDER: DueGroup[] = ['overdue', 'week', 'later', 'none', 'earlier'];

export type JobSection<T> = { key: DueGroup; title: string; rows: T[] };

/**
 * The Jobs tab's sections, in order, leaving out empty ones. Upcoming dates run soonest
 * first; Earlier runs latest first; jobs with no date run newest first.
 */
export function groupJobs<T extends JobRow>(rows: T[], now: number): JobSection<T>[] {
  const buckets = new Map<DueGroup, T[]>();
  for (const row of rows) {
    const key = dueGroup(row, now);
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }
  return GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => {
    const list = [...buckets.get(key)!];
    if (key === 'none') list.sort((a, b) => b.createdAt - a.createdAt);
    else if (key === 'earlier') list.sort((a, b) => b.collectOn! - a.collectOn!);
    else list.sort((a, b) => a.collectOn! - b.collectOn!);
    return { key, title: DUE_GROUP_TITLES[key], rows: list };
  });
}

export type WeekSummary = {
  /** Jobs due this week, plus overdue ones still owed. */
  dueCount: number;
  /** The soonest date due this week, if any. */
  nextDue: number | null;
  owedMinor: number;
  owedClients: number;
};

/** The two tiles on the Clients home. An overpaid job doesn't offset another. */
export function weekSummary(rows: JobRow[], now: number): WeekSummary {
  let dueCount = 0;
  let nextDue: number | null = null;
  let owedMinor = 0;
  const owing = new Set<string>();
  for (const row of rows) {
    const group = dueGroup(row, now);
    if (group === 'week' || group === 'overdue') dueCount += 1;
    if (group === 'week' && (nextDue == null || row.collectOn! < nextDue)) nextDue = row.collectOn;
    if (row.balanceMinor > 0) {
      owedMinor += row.balanceMinor;
      owing.add(row.clientId);
    }
  }
  return { dueCount, nextDue, owedMinor, owedClients: owing.size };
}

/** What each client still owes, for the Clients list. Clients who owe nothing are left out. */
export function owedByClient(rows: JobRow[]): Map<string, number> {
  const owed = new Map<string, number>();
  for (const row of rows) {
    if (row.balanceMinor > 0) owed.set(row.clientId, (owed.get(row.clientId) ?? 0) + row.balanceMinor);
  }
  return owed;
}

/** "TB" for Tunde Bello; one letter for a single name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * "Due Fri 21 Nov" this week, "Due 2 Aug" otherwise, with the year when it isn't this
 * year ("Due 9 Nov 2025"). Spelled out by hand so it reads the same on every phone.
 */
export function dueLabel(collectOn: number, now: number): string {
  const d = new Date(collectOn);
  const dayMonth = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (d.getFullYear() !== new Date(now).getFullYear()) return `Due ${dayMonth} ${d.getFullYear()}`;
  if (dueGroup({ collectOn, totalMinor: 0, paidMinor: 0, balanceMinor: 0 }, now) === 'week') {
    return `Due ${WEEKDAYS[d.getDay()]} ${dayMonth}`;
  }
  return `Due ${dayMonth}`;
}

/** A job row's second line: "2 items · Due Fri 21 Nov", or just the items with no date. */
export function jobMeta(row: Pick<JobRow, 'itemCount' | 'collectOn'>, now: number): string {
  const items = `${row.itemCount} ${row.itemCount === 1 ? 'item' : 'items'}`;
  return row.collectOn != null ? `${items} · ${dueLabel(row.collectOn, now)}` : items;
}

export const JOB_STATE_TITLES: Record<JobState, string> = {
  owed: 'Still owed',
  paid: 'Paid',
  unpriced: 'No price yet',
};

const STATE_ORDER: JobState[] = ['owed', 'paid', 'unpriced'];

/**
 * One client's jobs (S2a): Still owed, then Paid, then any with no price yet, leaving out
 * empty groups. Newest first within each.
 */
export function groupByState<T extends JobRow>(rows: T[]): { key: JobState; title: string; rows: T[] }[] {
  const sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt);
  return STATE_ORDER.map((key) => ({
    key,
    title: JOB_STATE_TITLES[key],
    rows: sorted.filter((r) => jobState(r) === key),
  })).filter((g) => g.rows.length > 0);
}

