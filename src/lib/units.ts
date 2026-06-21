/**
 * Inches-and-fraction formatting. Values are stored canonically as decimal inches
 * (e.g. 16.5); fractions (quarters) are a UI concern only (locked decision,
 * data-model §1). This mirrors the wireframe `fmt()` exactly: snap to the nearest
 * quarter within a 0.02 tolerance, render with the glyphs ¼ ½ ¾, and show whole
 * numbers with no fraction. The `″` suffix is added by `formatInches` (call sites in
 * the wireframe append it themselves).
 *
 * `eighths` is reserved for a future finer granularity (app_settings.fraction_granularity);
 * v1 implements `quarters`.
 */

export type FractionGranularity = 'quarters' | 'eighths';

/** Canonical quarter fractions and their display glyphs. */
export const QUARTER_GLYPHS: Record<number, string> = {
  0: '',
  0.25: '¼',
  0.5: '½',
  0.75: '¾',
};

/** Tolerance for snapping a decimal onto a quarter, matching the wireframe (`< .02`). */
const SNAP_TOLERANCE = 0.02;

/**
 * Format a decimal-inch value as inches-and-fraction WITHOUT the `″` suffix.
 * Mirrors the wireframe `fmt()`: `16.5 → "16 ½"`, `16 → "16"`, `0.25 → "¼"`,
 * `null → "—"`.
 */
export function formatValue(value: number | null | undefined): string {
  if (value == null) return '—';
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  let glyph = '';
  if (Math.abs(frac - 0.25) < SNAP_TOLERANCE) glyph = '¼';
  else if (Math.abs(frac - 0.5) < SNAP_TOLERANCE) glyph = '½';
  else if (Math.abs(frac - 0.75) < SNAP_TOLERANCE) glyph = '¾';
  if (whole === 0 && glyph) return glyph;
  return whole + (glyph ? ` ${glyph}` : '');
}

/**
 * Format a decimal-inch value for display WITH the `″` suffix (`16.5 → "16 ½″"`).
 * An unmeasured value renders as a bare `"—"` (no suffix), as in the wireframe.
 */
export function formatInches(
  value: number | null | undefined,
  _granularity: FractionGranularity = 'quarters',
): string {
  if (value == null) return '—';
  return `${formatValue(value)}″`;
}

export type SplitInches = {
  /** Whole-inch part (the number pad value). */
  whole: number;
  /** Snapped quarter fraction: 0, 0.25, 0.5, or 0.75. */
  fraction: 0 | 0.25 | 0.5 | 0.75;
  /** Display glyph for the fraction ('' for a whole number). */
  label: string;
};

/**
 * Split a decimal value into the whole + quarter-fraction the dock UI edits.
 * Snaps to the nearest quarter (canonical stored values are exact quarter steps;
 * this only guards float noise). `16.75 → { whole: 16, fraction: 0.75, label: '¾' }`.
 */
export function splitInches(value: number): SplitInches {
  const snapped = Math.round(value * 4) / 4;
  const whole = Math.floor(snapped + 1e-9);
  const fraction = (snapped - whole) as 0 | 0.25 | 0.5 | 0.75;
  return { whole, fraction, label: QUARTER_GLYPHS[fraction] ?? '' };
}

/**
 * Compose a whole number + quarter fraction back into a canonical decimal value
 * (the inverse of `splitInches`). `composeInches(16, 0.5) → 16.5`.
 */
export function composeInches(whole: number, fraction: 0 | 0.25 | 0.5 | 0.75 = 0): number {
  return whole + fraction;
}
