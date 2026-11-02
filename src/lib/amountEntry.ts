import { toMinor } from './money';

/**
 * What the money pad does. The buffer is the digits typed so far, in whole naira: the same
 * idea as the measuring pad, without a decimal point to fish for (data-model §3).
 */

const MAX_DIGITS = 9;

/** A digit on the end. Leading zeros are dropped. */
export function pressDigit(buffer: string, digit: string): string {
  const next = buffer === '0' ? digit : buffer + digit;
  if (next === '0') return '';
  return next.length > MAX_DIGITS ? buffer : next;
}

export function deleteDigit(buffer: string): string {
  return buffer.slice(0, -1);
}

/** The `,000` chip: 45 becomes 45000, the two-tap way to enter a price. */
export function addThousands(buffer: string): string {
  if (!buffer) return buffer;
  const next = `${buffer}000`;
  return next.length > MAX_DIGITS ? buffer : next;
}

export function bufferToMinor(buffer: string): number {
  return buffer ? toMinor(Number(buffer)) : 0;
}

/** Minor units back to pad digits, rounded up to a whole unit. Nothing owed is empty. */
export function minorToBuffer(minor: number): string {
  return minor > 0 ? String(Math.ceil(minor / 100)) : '';
}

/** The Half chip, rounded up so a tailor never collects a kobo short. */
export function halfOf(minor: number): string {
  return minorToBuffer(minor / 2);
}
