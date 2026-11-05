import { historyRows, setMetaLine, setTitle } from '../setDetail';

const DAY = 24 * 60 * 60 * 1000;

describe('setTitle', () => {
  it('uses the label, else the template name', () => {
    expect(setTitle('Wedding agbada', "Men's")).toBe('Wedding agbada');
    expect(setTitle(null, "Men's")).toBe("Men's");
    expect(setTitle('  ', undefined)).toBe('Measurement set');
  });
});

describe('setMetaLine', () => {
  it('joins the client, the template and when it was updated', () => {
    const now = Date.now();
    expect(setMetaLine('Tunde Bello', "Men's", now - 14 * DAY)).toBe("Tunde Bello · Men's · updated 2 weeks ago");
  });

  it('leaves out what is missing', () => {
    expect(setMetaLine('Tunde Bello', undefined, Date.now())).toBe('Tunde Bello · updated just now');
  });
});

describe('historyRows', () => {
  const nov3 = new Date(2026, 10, 3, 12).getTime();
  const may12 = new Date(2026, 4, 12, 12).getTime();
  const jan3 = new Date(2026, 0, 3, 12).getTime();

  it('puts the current value first as "Now", then earlier values with their dates', () => {
    const rows = historyRows({ value: 26.75, at: nov3 }, [
      { id: 'a', value: 26.5, recordedAt: may12 },
      { id: 'b', value: 26, recordedAt: jan3 },
    ]);
    expect(rows).toEqual([
      { key: 'now', when: 'Now · 3 Nov 2026', value: 26.75, now: true },
      { key: 'a', when: '12 May 2026', value: 26.5, now: false },
      { key: 'b', when: '3 Jan 2026', value: 26, now: false },
    ]);
  });

  it('is empty for an item never measured', () => {
    expect(historyRows({ value: null, at: null }, [])).toEqual([]);
  });
});
