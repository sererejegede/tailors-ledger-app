import { formatValue } from './units';

/**
 * The words the measuring screen (S5) shows around a value: the template item's usual
 * range on the active row, the "Check" tag on a value outside it, and the dock's
 * "still empty" confirm. Pure, so they're tested without rendering.
 */

/** "38–44″", "at least 38″", "up to 44″", or null when the item has no range. */
export function rangeText(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `${formatValue(min)}–${formatValue(max)}″`;
  if (min != null) return `at least ${formatValue(min)}″`;
  if (max != null) return `up to ${formatValue(max)}″`;
  return null;
}

/** Under the active row: "Usually 38–44″". */
export function usuallyHint(min?: number | null, max?: number | null): string | null {
  const range = rangeText(min, max);
  return range ? `Usually ${range}` : null;
}

/** On a row whose value is outside its range: "Check: usually 14–20″". */
export function checkHint(min?: number | null, max?: number | null): string {
  const range = rangeText(min, max);
  return range ? `Check: usually ${range}` : 'Check this value';
}

/** The dock's progress bar, 0 to 1. */
export function filledShare(filled: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, filled / total));
}

/**
 * What Save set asks before saving a set with gaps, or null when every item is filled.
 * It never blocks: the tailor can always save anyway (spec §4).
 */
export function emptyItemsPrompt(filled: number, total: number): string | null {
  const empty = total - filled;
  if (empty <= 0) return null;
  return `${empty} item${empty === 1 ? '' : 's'} still empty. Save anyway?`;
}
