import { Alert } from '@/lib/alert';
import { formatMoney } from '@/lib/money';

/** How far a payment goes over what's owed, or 0. A balance at or below 0 owes nothing. */
export function overpaymentMinor(balanceMinor: number, amountMinor: number): number {
  return Math.max(0, amountMinor - Math.max(balanceMinor, 0));
}

/**
 * Paying more than the balance is allowed (data-model §3), but asked about first, so a slip
 * like an extra 0 is caught before it prints. Asks even when items aren't priced yet.
 */
export function confirmPayment(
  balanceMinor: number,
  amountMinor: number,
  currency: string,
  record: () => void,
): void {
  const over = overpaymentMinor(balanceMinor, amountMinor);
  if (!over) {
    record();
    return;
  }
  const money = (minor: number) => formatMoney(minor, currency);
  Alert.alert(
    'More than the balance',
    `${money(amountMinor)} is ${money(over)} more than the ${money(Math.max(balanceMinor, 0))} balance. Record it anyway?`,
    [
      { text: 'Change amount', style: 'cancel' },
      { text: 'Record anyway', onPress: record },
    ],
  );
}
