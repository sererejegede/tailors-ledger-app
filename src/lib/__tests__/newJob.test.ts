import { addDoubleZero } from '../amountEntry';
import { draftEntered, draftToItems, draftTotalMinor, type DraftLine } from '../newJob';

const line = (name: string, price = ''): DraftLine => ({ key: name || Math.random().toString(), name, price });

describe('New job (S8)', () => {
  it('totals the priced lines; unpriced ones count as 0', () => {
    expect(draftTotalMinor([line('Agbada', '85000'), line('Senator', '60000'), line('Iro and buba')])).toBe(14500000);
    expect(draftTotalMinor([])).toBe(0);
  });

  it('creates each item with quantity 1, its price, and no measurement set', () => {
    expect(draftToItems([line(' Agbada ', '85000'), line('Iro and buba')])).toEqual({
      items: [
        { description: 'Agbada', quantity: 1, unitPriceMinor: 8500000, setId: null },
        { description: 'Iro and buba', quantity: 1, unitPriceMinor: null, setId: null },
      ],
    });
  });

  it('skips empty rows', () => {
    expect(draftToItems([line('Agbada'), line('  ')])).toEqual({
      items: [{ description: 'Agbada', quantity: 1, unitPriceMinor: null, setId: null }],
    });
  });

  it('needs at least one item', () => {
    expect(draftToItems([line('')])).toEqual({ error: 'Add at least one item.' });
  });

  it('will not drop a price that has no name', () => {
    expect(draftToItems([line('Agbada'), line('', '5000')])).toEqual({ error: 'Give each priced item a name.' });
  });

  it('asks before leaving only once something is entered', () => {
    expect(draftEntered([line('')], '', null)).toBe(false);
    expect(draftEntered([line('Agbada')], '', null)).toBe(true);
    expect(draftEntered([], 'Wedding', null)).toBe(true);
    expect(draftEntered([], '', 1)).toBe(true);
  });
});

describe('the price pad', () => {
  it('adds two zeros with the 00 chip, up to nine digits', () => {
    expect(addDoubleZero('45')).toBe('4500');
    expect(addDoubleZero('')).toBe('');
    expect(addDoubleZero('12345678')).toBe('12345678');
  });
});
