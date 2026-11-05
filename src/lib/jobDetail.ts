import { bufferToMinor } from './amountEntry';
import { formatMoney, lineTotalMinor } from './money';

/**
 * The words and edits on Job detail (S9, S9a). Pure, so they're tested without rendering.
 */

/** The balance card's bar: how much of the total is paid, 0 to 1. */
export function paidShare(paidMinor: number, totalMinor: number): number {
  if (totalMinor <= 0) return paidMinor > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, paidMinor / totalMinor));
}

/**
 * An item's price on the list: the line total, with "× 2" for old items that have a
 * quantity above 1. Null when it has no price yet ("Add price").
 */
export function itemPrice(
  quantity: number,
  unitPriceMinor: number | null | undefined,
  currency: string,
): { amount: string; times: string | null } | null {
  if (unitPriceMinor == null) return null;
  return {
    amount: formatMoney(lineTotalMinor(quantity, unitPriceMinor), currency),
    times: quantity > 1 ? `× ${quantity}` : null,
  };
}

/** Saving an item typed in the list: its name and price (empty = no price yet). */
export function itemEdit(
  name: string,
  priceBuffer: string,
): { description: string; unitPriceMinor: number | null } | { error: string } {
  const description = name.trim();
  if (!description) return { error: 'Give the item a name.' };
  return { description, unitPriceMinor: priceBuffer ? bufferToMinor(priceBuffer) : null };
}
