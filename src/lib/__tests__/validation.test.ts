import { rangeWarning } from '../validation';

describe('rangeWarning (soft, non-blocking)', () => {
  it('returns null when the value is within range', () => {
    expect(rangeWarning(16, 13, 20)).toBeNull();
  });

  it('flags a value below the floor (the classic "1.6" vs "16" slip)', () => {
    expect(rangeWarning(1.6, 13, 20)).toEqual({ kind: 'below', bound: 13, min: 13, max: 20 });
  });

  it('flags a value above the ceiling', () => {
    expect(rangeWarning(60, 13, 20)).toEqual({ kind: 'above', bound: 20, min: 13, max: 20 });
  });

  it('treats the bounds as inclusive', () => {
    expect(rangeWarning(13, 13, 20)).toBeNull();
    expect(rangeWarning(20, 13, 20)).toBeNull();
  });

  it('handles open-ended ranges', () => {
    expect(rangeWarning(5, 10, undefined)).toEqual({ kind: 'below', bound: 10, min: 10, max: undefined });
    expect(rangeWarning(50, undefined, 20)).toEqual({ kind: 'above', bound: 20, min: undefined, max: 20 });
    expect(rangeWarning(15, undefined, undefined)).toBeNull();
  });

  it('never warns when there is no value', () => {
    expect(rangeWarning(null, 13, 20)).toBeNull();
    expect(rangeWarning(undefined, 13, 20)).toBeNull();
  });
});
