import { formatDate, getRelativeTime } from './time';

/**
 * The words on Set detail (S6) and the one-item sheet (S7). Pure, so they're tested
 * without rendering.
 */

/** The header: the set's label, else its template's name. */
export function setTitle(label?: string | null, templateName?: string | null): string {
  return label?.trim() || templateName?.trim() || 'Measurement set';
}

/** Under the header: "Tunde Bello · Men's · updated 2 weeks ago". */
export function setMetaLine(
  clientName: string | null | undefined,
  templateName: string | null | undefined,
  updatedAt: number,
): string {
  return [clientName, templateName, `updated ${getRelativeTime(updatedAt)}`].filter(Boolean).join(' · ');
}

export type HistoryRow = { key: string; when: string; value: number; now: boolean };

/**
 * An item's history for S7, newest first: the current value as "Now · 3 Nov 2026", then
 * each earlier value with its date. `earlier` excludes the current value (as
 * `earlierValuesByItem` returns it).
 */
export function historyRows(
  current: { value: number | null | undefined; at: number | null | undefined },
  earlier: { id: string; value: number; recordedAt: number }[],
): HistoryRow[] {
  const rows: HistoryRow[] = [];
  if (current.value != null) {
    rows.push({
      key: 'now',
      when: current.at != null ? `Now · ${formatDate(current.at)}` : 'Now',
      value: current.value,
      now: true,
    });
  }
  for (const v of earlier) {
    rows.push({ key: v.id, when: formatDate(v.recordedAt), value: v.value, now: false });
  }
  return rows;
}
