import type { ReceiptKind, ReceiptSnapshot } from '@/db/models/Payment';
import { formatMoney, formatReceiptNumber } from './money';
import { formatDate, formatWeekday } from './time';

/**
 * A receipt ready to show: every value formatted, once, so the phone preview and the PDF
 * can't disagree. All of it comes from the frozen snapshot (data-model §3), so re-sending
 * an old receipt never changes it. The only live part is whether it has since been voided.
 */

export type ReceiptSource = {
  receiptNumber: number;
  amountMinor: number;
  paidAt: number;
  voidedAt?: number | null;
  receipt: ReceiptSnapshot;
};

export type ReceiptLineView = { name: string; detail: string; amount: string };

export type ReceiptView = {
  number: string;
  date: string;
  shopName: string;
  shopContact: string;
  footer: string;
  client: string;
  job: string | null;
  items: ReceiptLineView[];
  total: string;
  kind: ReceiptKind;
  amount: string;
  paid: string;
  balance: string;
  paidInFull: boolean;
  collection: string | null;
  voided: boolean;
};

export const UNPRICED = '—';

/** "2 × ₦30,000", "× 3" while unpriced, or nothing for one of something. */
export function lineDetail(quantity: number, unitPriceMinor: number | null, money: (minor: number) => string): string {
  if (quantity <= 1) return '';
  return unitPriceMinor != null ? `${quantity} × ${money(unitPriceMinor)}` : `× ${quantity}`;
}

export function receiptView(source: ReceiptSource): ReceiptView {
  const { receipt } = source;
  const money = (minor: number) => formatMoney(minor, receipt.currency);
  const voided = source.voidedAt != null;
  // A voided receipt no longer counts, so it shows the job as if it was never paid.
  const undo = voided ? source.amountMinor : 0;
  const balanceMinor = receipt.balance_minor + undo;

  return {
    number: formatReceiptNumber(source.receiptNumber),
    date: formatDate(source.paidAt),
    shopName: receipt.shop.name,
    shopContact: [receipt.shop.address, receipt.shop.phone].filter(Boolean).join(' · '),
    footer: receipt.shop.footer,
    client: receipt.client_name,
    job: receipt.job_title,
    items: receipt.items.map((line) => ({
      name: line.description,
      detail: lineDetail(line.quantity, line.unit_price_minor, money),
      amount: line.unit_price_minor == null ? UNPRICED : money(line.line_total_minor),
    })),
    total: money(receipt.total_minor),
    kind: receipt.kind,
    amount: money(source.amountMinor),
    paid: money(receipt.paid_so_far_minor - undo),
    balance: money(balanceMinor),
    paidInFull: !voided && balanceMinor === 0 && receipt.total_minor > 0,
    collection: receipt.collect_on != null ? formatWeekday(receipt.collect_on) : null,
    voided,
  };
}
