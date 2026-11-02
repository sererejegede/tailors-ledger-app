/**
 * Money helpers. Amounts are always integers of minor units (₦50,000 is 5000000), never
 * decimals (data-model §3); the tailor enters whole naira, so entry goes through `toMinor`
 * and display through `formatMoney`.
 */

const MINOR_PER_MAJOR = 100;

export const DEFAULT_CURRENCY = 'NGN';

export const CURRENCIES = [
  { code: 'NGN', symbol: '₦', name: 'Naira' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'Pound' },
] as const;

/** Whole currency units → minor units. */
export function toMinor(major: number): number {
  return Math.round(major * MINOR_PER_MAJOR);
}

/** The currency's symbol, or its code plus a space when we don't know it. */
function symbolFor(currency: string): string {
  return CURRENCIES.find((c) => c.code === currency)?.symbol ?? `${currency} `;
}

/** 11000000 → "₦110,000"; 125050 → "₦1,250.50"; -500000 → "-₦5,000". */
export function formatMoney(minor: number, currency: string = DEFAULT_CURRENCY): string {
  const abs = Math.abs(minor);
  const major = Math.floor(abs / MINOR_PER_MAJOR);
  const rest = abs % MINOR_PER_MAJOR;
  const whole = String(major).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = rest ? `.${String(rest).padStart(2, '0')}` : '';
  return `${minor < 0 ? '-' : ''}${symbolFor(currency)}${whole}${cents}`;
}

/** A line's total. An unpriced line counts as 0 (data-model §3). */
export function lineTotalMinor(quantity: number, unitPriceMinor: number | null | undefined): number {
  return quantity * (unitPriceMinor ?? 0);
}

/** 42 → "R-0042". */
export function formatReceiptNumber(n: number): string {
  return `R-${String(n).padStart(4, '0')}`;
}
