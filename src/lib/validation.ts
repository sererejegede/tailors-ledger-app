/**
 * Soft, non-blocking range validation (spec §7). A template item may carry an optional
 * expected range (`min_range`/`max_range`, inches); a value wildly outside it gets a
 * subtle warning — e.g. catching "1.6" vs "16" — but NEVER blocks saving. This is a
 * pure function so the UI can decide how (or whether) to surface it.
 */

export type RangeWarning = {
  kind: 'below' | 'above';
  /** The bound that was crossed (the relevant one for the kind). */
  bound: number;
  min?: number;
  max?: number;
};

/**
 * Return a warning if `value` falls outside [min, max], else `null`. Either bound may
 * be omitted (open-ended range); `null` when in range or when no range is configured.
 */
export function rangeWarning(
  value: number | null | undefined,
  min?: number | null,
  max?: number | null,
): RangeWarning | null {
  if (value == null) return null;
  if (min != null && value < min) {
    return { kind: 'below', bound: min, min: min ?? undefined, max: max ?? undefined };
  }
  if (max != null && value > max) {
    return { kind: 'above', bound: max, min: min ?? undefined, max: max ?? undefined };
  }
  return null;
}
