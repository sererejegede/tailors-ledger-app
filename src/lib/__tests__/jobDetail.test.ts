import { itemEdit, itemPrice, paidShare } from '../jobDetail';

describe('paidShare', () => {
  it('fills the balance bar by what is paid', () => {
    expect(paidShare(5000000, 14500000)).toBeCloseTo(0.345, 3);
    expect(paidShare(0, 14500000)).toBe(0);
    expect(paidShare(20000000, 14500000)).toBe(1);
  });

  it('copes with a job that has no price yet', () => {
    expect(paidShare(0, 0)).toBe(0);
    expect(paidShare(5000000, 0)).toBe(1);
  });
});

describe('itemPrice', () => {
  it('shows the line total', () => {
    expect(itemPrice(1, 8500000, 'NGN')).toEqual({ amount: '₦85,000', times: null });
  });

  it('shows "× 2" for old items with a quantity', () => {
    expect(itemPrice(2, 3000000, 'NGN')).toEqual({ amount: '₦60,000', times: '× 2' });
  });

  it('is null with no price yet', () => {
    expect(itemPrice(1, null, 'NGN')).toBeNull();
  });
});

describe('itemEdit', () => {
  it('saves the trimmed name and the price in kobo', () => {
    expect(itemEdit(' Iro and buba ', '25000')).toEqual({ description: 'Iro and buba', unitPriceMinor: 2500000 });
  });

  it('leaves the price off when it is cleared', () => {
    expect(itemEdit('Iro and buba', '')).toEqual({ description: 'Iro and buba', unitPriceMinor: null });
  });

  it('needs a name', () => {
    expect(itemEdit('  ', '25000')).toEqual({ error: 'Give the item a name.' });
  });
});
