import { invoiceView, PRICE_TO_FOLLOW, type InvoiceSource } from '../invoice';
import { invoiceHtml } from '../invoiceHtml';

const source: InvoiceSource = {
  date: new Date(2026, 10, 2).getTime(),
  shop: { name: 'Kunle Couture', phone: '+234 803 555 0142', address: '14 Allen Avenue, Ikeja', footer: 'Thank you.' },
  bank: { name: 'GTBank', accountName: 'Kunle Couture', accountNumber: '0123456789' },
  clientName: 'Tunde Bello',
  clientPhone: '+234 803 555 0199',
  jobTitle: 'Wedding outfits',
  collectOn: new Date(2026, 10, 14).getTime(),
  currency: 'NGN',
  items: [
    { description: 'Agbada, 3-piece', quantity: 1, unitPriceMinor: 4500000 },
    { description: 'Senator suit', quantity: 2, unitPriceMinor: 3000000 },
    { description: 'Cap', quantity: 1, unitPriceMinor: 500000 },
  ],
  payments: [{ amountMinor: 5000000, voidedAt: null }],
};

describe('invoiceView', () => {
  it('shows a part-paid job as it is now', () => {
    const view = invoiceView(source);
    expect(view.date).toBe('2 Nov 2026');
    expect(view.client).toBe('Tunde Bello');
    expect(view.clientPhone).toBe('+234 803 555 0199');
    expect(view.job).toBe('Wedding outfits');
    expect(view.total).toBe('₦110,000');
    expect(view.paid).toBe('₦50,000');
    expect(view.balance).toBe('₦60,000');
    expect(view.collection).toBe('Sat 14 Nov');
    expect(view.paidInFull).toBe(false);
    expect(view.unpriced).toBeNull();
    expect(view.items[1]).toEqual({ name: 'Senator suit', detail: '2 × ₦30,000', amount: '₦60,000', pending: false });
  });

  it('leaves out paid so far before the first payment, and voided payments', () => {
    expect(invoiceView({ ...source, payments: [] }).paid).toBeNull();
    const voided = invoiceView({ ...source, payments: [{ amountMinor: 5000000, voidedAt: 1 }] });
    expect(voided.paid).toBeNull();
    expect(voided.balance).toBe('₦110,000');
  });

  it('says price to follow for an unpriced item, and counts them', () => {
    const items = [
      { description: 'Iro and buba', quantity: 1, unitPriceMinor: 3800000 },
      { description: 'Gele', quantity: 2, unitPriceMinor: null },
    ];
    const view = invoiceView({ ...source, items, payments: [] });
    expect(view.items[1]).toEqual({ name: 'Gele', detail: '× 2', amount: PRICE_TO_FOLLOW, pending: true });
    expect(view.total).toBe('₦38,000');
    expect(view.unpriced).toBe('1 item not priced yet');
    expect(invoiceView({ ...source, items: [items[1], items[1]] }).unpriced).toBe('2 items not priced yet');
  });

  it('shows paid in full, with no due date, once nothing is left to pay', () => {
    const view = invoiceView({ ...source, payments: [{ amountMinor: 11000000 }] });
    expect(view.paidInFull).toBe(true);
    expect(view.collection).toBeNull();
  });

  it('is not paid in full while an item still has no price', () => {
    const items = [...source.items, { description: 'Gele', quantity: 1, unitPriceMinor: null }];
    expect(invoiceView({ ...source, items, payments: [{ amountMinor: 11000000 }] }).paidInFull).toBe(false);
  });

  it('lists only the payment details that are filled in', () => {
    expect(invoiceView(source).bank.map((b) => b.label)).toEqual(['Bank', 'Account name', 'Account number']);
    const some = invoiceView({ ...source, bank: { name: ' ', accountName: '', accountNumber: '0123456789' } });
    expect(some.bank).toEqual([{ label: 'Account number', value: '0123456789', number: true }]);
  });

  it('leaves out what a walk-in job does not have', () => {
    const view = invoiceView({ ...source, clientPhone: ' ', jobTitle: null, collectOn: null });
    expect(view.clientPhone).toBeNull();
    expect(view.job).toBeNull();
    expect(view.collection).toBeNull();
  });
});

describe('invoiceHtml', () => {
  const html = (over: Partial<InvoiceSource> = {}, logoSrc: string | null = null) =>
    invoiceHtml(invoiceView({ ...source, ...over }), { logoSrc, pageWidth: 420 });

  it('prints the bill, the balance due and the due date', () => {
    const page = html();
    expect(page).toContain('INVOICE');
    expect(page).toContain('Bill to');
    expect(page).toContain('+234 803 555 0199');
    expect(page).toContain('Senator suit');
    expect(page).toContain('Paid so far');
    expect(page).toContain('Balance due');
    expect(page).toContain('₦60,000');
    expect(page).toContain('Due on collection, Sat 14 Nov');
    expect(page).not.toContain('R-0');
  });

  it('prints the payment details, account number intact', () => {
    const page = html();
    expect(page).toContain('Pay by bank transfer');
    expect(page).toContain('0123456789');
    expect(html({ bank: { name: '', accountName: '', accountNumber: '' } })).not.toContain('Pay by bank transfer');
  });

  it('marks a settled job paid in full', () => {
    const page = html({ payments: [{ amountMinor: 11000000 }] });
    expect(page).toContain('PAID IN FULL');
    expect(page).not.toContain('Balance due');
  });

  it('shows the unpriced count and leaves out paid so far before any payment', () => {
    const page = html({ items: [{ description: 'Gele', quantity: 1, unitPriceMinor: null }], payments: [] });
    expect(page).toContain(PRICE_TO_FOLLOW);
    expect(page).toContain('1 item not priced yet');
    expect(page).not.toContain('Paid so far');
  });

  it('shows the logo only when there is one', () => {
    expect(html()).not.toContain('<img');
    expect(html({}, 'data:image/png;base64,AAAA')).toContain('data:image/png;base64,AAAA');
  });

  it('escapes what the tailor typed', () => {
    const page = html({ clientName: '<b>Ade & Sons</b>', bank: { name: 'A&B', accountName: '', accountNumber: '' } });
    expect(page).toContain('&lt;b&gt;Ade &amp; Sons&lt;/b&gt;');
    expect(page).toContain('A&amp;B');
    expect(page).not.toContain('<b>Ade');
  });
});
