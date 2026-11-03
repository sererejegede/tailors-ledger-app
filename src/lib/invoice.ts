import { totalsFor } from '@/repositories/jobs';
import { formatMoney, lineTotalMinor } from './money';
import { lineDetail } from './receipt';
import { formatDate, formatWeekday } from './time';

/**
 * An invoice ready to show, every value formatted once so the phone preview and the PDF
 * can't disagree. Unlike a receipt nothing is frozen: it's drawn from the job as it is now
 * (data-model §3, "Invoices"), so it has no number and is dated the day it's shared.
 */

export type InvoiceSource = {
  date: number;
  shop: { name: string; phone: string; address: string; footer: string };
  bank: { name: string; accountName: string; accountNumber: string };
  clientName: string;
  clientPhone: string;
  jobTitle: string | null;
  collectOn: number | null;
  currency: string;
  items: { description: string; quantity: number; unitPriceMinor: number | null }[];
  payments: { amountMinor: number; voidedAt?: number | null }[];
};

export type InvoiceLineView = { name: string; detail: string; amount: string; pending: boolean };
export type BankLineView = { label: string; value: string; number: boolean };

export type InvoiceView = {
  date: string;
  shopName: string;
  shopContact: string;
  footer: string;
  client: string;
  /** The client's phone, when it's on file. */
  clientPhone: string | null;
  job: string | null;
  items: InvoiceLineView[];
  total: string;
  /** "1 item not priced yet", or null when every item has a price. */
  unpriced: string | null;
  /** What's been paid, or null before the first payment. */
  paid: string | null;
  balance: string;
  paidInFull: boolean;
  /** The due date: the job's collection date, unless there's nothing left to pay. */
  collection: string | null;
  /** The filled-in payment details. Empty hides the transfer box. */
  bank: BankLineView[];
};

export const PRICE_TO_FOLLOW = 'Price to follow';

export function invoiceView(source: InvoiceSource): InvoiceView {
  const money = (minor: number) => formatMoney(minor, source.currency);
  const { totalMinor, paidMinor, balanceMinor } = totalsFor(source.items, source.payments);
  const unpricedCount = source.items.filter((i) => i.unitPriceMinor == null).length;
  // An unpriced item is still to pay for, so the job isn't settled while one is left.
  const paidInFull = unpricedCount === 0 && totalMinor > 0 && balanceMinor <= 0;

  const bank: BankLineView[] = [
    { label: 'Bank', value: source.bank.name, number: false },
    { label: 'Account name', value: source.bank.accountName, number: false },
    { label: 'Account number', value: source.bank.accountNumber, number: true },
  ]
    .map((line) => ({ ...line, value: line.value.trim() }))
    .filter((line) => line.value);

  return {
    date: formatDate(source.date),
    shopName: source.shop.name,
    shopContact: [source.shop.address, source.shop.phone].filter(Boolean).join(' · '),
    footer: source.shop.footer,
    client: source.clientName,
    clientPhone: source.clientPhone.trim() || null,
    job: source.jobTitle || null,
    items: source.items.map((item) => ({
      name: item.description,
      detail: lineDetail(item.quantity, item.unitPriceMinor, money),
      amount: item.unitPriceMinor == null ? PRICE_TO_FOLLOW : money(lineTotalMinor(item.quantity, item.unitPriceMinor)),
      pending: item.unitPriceMinor == null,
    })),
    total: money(totalMinor),
    unpriced: unpricedCount ? `${unpricedCount} ${unpricedCount === 1 ? 'item' : 'items'} not priced yet` : null,
    paid: paidMinor > 0 ? money(paidMinor) : null,
    balance: money(balanceMinor),
    paidInFull,
    collection: source.collectOn != null && !paidInFull ? formatWeekday(source.collectOn) : null,
    bank,
  };
}
