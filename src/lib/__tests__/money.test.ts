import { formatMoney, formatReceiptNumber, lineTotalMinor, toMinor } from '../money';

describe('toMinor', () => {
  it('turns whole units into minor units', () => {
    expect(toMinor(50000)).toBe(5000000);
    expect(toMinor(0)).toBe(0);
  });

  it('never leaves a float behind', () => {
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(1.1)).toBe(110);
  });
});

describe('formatMoney', () => {
  it('groups thousands and drops empty kobo', () => {
    expect(formatMoney(11000000)).toBe('₦110,000');
    expect(formatMoney(100000)).toBe('₦1,000');
    expect(formatMoney(50000)).toBe('₦500');
    expect(formatMoney(0)).toBe('₦0');
  });

  it('shows kobo when there are any', () => {
    expect(formatMoney(125050)).toBe('₦1,250.50');
    expect(formatMoney(5)).toBe('₦0.05');
  });

  it('shows a negative balance', () => {
    expect(formatMoney(-500000)).toBe('-₦5,000');
  });

  it('uses the currency given, and the code for an unknown one', () => {
    expect(formatMoney(100000, 'GBP')).toBe('£1,000');
    expect(formatMoney(100000, 'KES')).toBe('KES 1,000');
  });
});

describe('lineTotalMinor', () => {
  it('multiplies quantity by price', () => {
    expect(lineTotalMinor(2, 3000000)).toBe(6000000);
  });

  it('counts an unpriced line as 0', () => {
    expect(lineTotalMinor(2, null)).toBe(0);
    expect(lineTotalMinor(2, undefined)).toBe(0);
  });
});

describe('formatReceiptNumber', () => {
  it('pads to four digits and keeps larger numbers whole', () => {
    expect(formatReceiptNumber(42)).toBe('R-0042');
    expect(formatReceiptNumber(12345)).toBe('R-12345');
  });
});
