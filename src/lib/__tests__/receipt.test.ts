import type { ReceiptSnapshot } from '@/db/models/Payment';
import { receiptView, UNPRICED, type ReceiptSource } from '../receipt';
import { receiptHtml } from '../receiptHtml';

const snapshot: ReceiptSnapshot = {
  v: 1,
  kind: 'Deposit',
  shop: { name: 'Kunle Couture', phone: '+234 803 555 0142', address: '14 Allen Avenue, Ikeja', footer: 'Thank you.' },
  client_name: 'Tunde Bello',
  job_title: 'Wedding outfits',
  collect_on: new Date(2026, 10, 14).getTime(),
  currency: 'NGN',
  items: [
    { description: 'Agbada, 3-piece', quantity: 1, unit_price_minor: 4500000, line_total_minor: 4500000 },
    { description: 'Senator suit', quantity: 2, unit_price_minor: 3000000, line_total_minor: 6000000 },
    { description: 'Cap', quantity: 3, unit_price_minor: null, line_total_minor: 0 },
  ],
  total_minor: 10500000,
  paid_so_far_minor: 5000000,
  balance_minor: 5500000,
};

const source: ReceiptSource = {
  receiptNumber: 42,
  amountMinor: 5000000,
  paidAt: new Date(2026, 9, 30).getTime(),
  voidedAt: null,
  receipt: snapshot,
};

describe('receiptView', () => {
  it('formats what the receipt froze', () => {
    const view = receiptView(source);
    expect(view.number).toBe('R-0042');
    expect(view.date).toBe('30 Oct 2026');
    expect(view.shopContact).toBe('14 Allen Avenue, Ikeja · +234 803 555 0142');
    expect(view.amount).toBe('₦50,000');
    expect(view.paid).toBe('₦50,000');
    expect(view.balance).toBe('₦55,000');
    expect(view.collection).toBe('Sat 14 Nov');
    expect(view.paidInFull).toBe(false);
  });

  it('writes each line the way a tailor would', () => {
    const [one, two, unpriced] = receiptView(source).items;
    expect(one).toEqual({ name: 'Agbada, 3-piece', detail: '', amount: '₦45,000' });
    expect(two).toEqual({ name: 'Senator suit', detail: '2 × ₦30,000', amount: '₦60,000' });
    expect(unpriced).toEqual({ name: 'Cap', detail: '× 3', amount: UNPRICED });
  });

  it('shows paid in full only when the balance is exactly zero', () => {
    const cleared = { ...snapshot, paid_so_far_minor: 10500000, balance_minor: 0 };
    expect(receiptView({ ...source, receipt: cleared }).paidInFull).toBe(true);
    const over = { ...snapshot, balance_minor: -100000 };
    expect(receiptView({ ...source, receipt: over }).paidInFull).toBe(false);
    expect(receiptView({ ...source, receipt: over }).balance).toBe('-₦1,000');
  });

  it('takes a voided receipt out of paid and balance', () => {
    const view = receiptView({ ...source, voidedAt: 1 });
    expect(view.voided).toBe(true);
    expect(view.amount).toBe('₦50,000');
    expect(view.paid).toBe('₦0');
    expect(view.balance).toBe('₦105,000');
    expect(view.paidInFull).toBe(false);
  });

  it('leaves out what a walk-in job does not have', () => {
    const view = receiptView({ ...source, receipt: { ...snapshot, job_title: null, collect_on: null } });
    expect(view.job).toBeNull();
    expect(view.collection).toBeNull();
  });
});

describe('receiptHtml', () => {
  const html = (over: Partial<ReceiptSource> = {}, logoSrc: string | null = null) =>
    receiptHtml(receiptView({ ...source, ...over }), { logoSrc, pageWidth: 420 });

  it('prints the items, amount and balance', () => {
    const page = html();
    expect(page).toContain('R-0042');
    expect(page).toContain('Senator suit');
    expect(page).toContain('₦55,000');
    expect(page).toContain('Amount received');
    expect(page).toContain('Sat 14 Nov');
  });

  it('marks a voided receipt', () => {
    const page = html({ voidedAt: 1 });
    expect(page).toContain('VOID');
    expect(page).not.toContain('Amount received');
  });

  it('shows the logo only when there is one', () => {
    expect(html()).not.toContain('<img');
    expect(html({}, 'data:image/png;base64,AAAA')).toContain('data:image/png;base64,AAAA');
  });

  it('escapes what the tailor typed', () => {
    const receipt = { ...snapshot, client_name: '<b>Ade & Sons</b>' };
    const page = html({ receipt });
    expect(page).toContain('&lt;b&gt;Ade &amp; Sons&lt;/b&gt;');
    expect(page).not.toContain('<b>Ade');
  });
});
