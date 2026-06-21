import {
  formatValue,
  formatInches,
  splitInches,
  composeInches,
} from '../units';

describe('formatValue (mirrors wireframe fmt)', () => {
  it('renders whole numbers with no fraction', () => {
    expect(formatValue(16)).toBe('16');
    expect(formatValue(0)).toBe('0');
  });

  it('renders the quarter glyphs', () => {
    expect(formatValue(16.25)).toBe('16 ¼');
    expect(formatValue(16.5)).toBe('16 ½');
    expect(formatValue(16.75)).toBe('16 ¾');
  });

  it('drops the leading zero for sub-inch fractions', () => {
    expect(formatValue(0.25)).toBe('¼');
    expect(formatValue(0.5)).toBe('½');
  });

  it('snaps within the 0.02 tolerance', () => {
    expect(formatValue(16.49)).toBe('16 ½');
    expect(formatValue(16.26)).toBe('16 ¼');
  });

  it('renders an empty value as an em dash', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
  });
});

describe('formatInches (with the ″ suffix)', () => {
  it('appends the inch mark for real values', () => {
    expect(formatInches(16.5)).toBe('16 ½″');
    expect(formatInches(16)).toBe('16″');
  });

  it('shows a bare dash (no suffix) for empty', () => {
    expect(formatInches(null)).toBe('—');
  });
});

describe('splitInches / composeInches', () => {
  it('splits a decimal into whole + quarter fraction', () => {
    expect(splitInches(16.75)).toEqual({ whole: 16, fraction: 0.75, label: '¾' });
    expect(splitInches(16)).toEqual({ whole: 16, fraction: 0, label: '' });
    expect(splitInches(16.5)).toEqual({ whole: 16, fraction: 0.5, label: '½' });
  });

  it('snaps noisy decimals to the nearest quarter', () => {
    expect(splitInches(16.74)).toEqual({ whole: 16, fraction: 0.75, label: '¾' });
  });

  it('composes back to the canonical decimal (round-trip)', () => {
    for (const v of [10, 10.25, 10.5, 10.75, 0.25, 33.5]) {
      const { whole, fraction } = splitInches(v);
      expect(composeInches(whole, fraction)).toBeCloseTo(v, 6);
    }
  });
});
