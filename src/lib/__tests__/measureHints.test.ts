import { checkHint, emptyItemsPrompt, filledShare, rangeText, usuallyHint } from '../measureHints';

describe('rangeText', () => {
  it('shows both ends of a range in inches and quarters', () => {
    expect(rangeText(38, 44)).toBe('38–44″');
    expect(rangeText(13.5, 20.75)).toBe('13 ½–20 ¾″');
  });

  it('handles an open-ended range', () => {
    expect(rangeText(38, null)).toBe('at least 38″');
    expect(rangeText(undefined, 44)).toBe('up to 44″');
  });

  it('is null when the item has no range', () => {
    expect(rangeText(null, null)).toBeNull();
    expect(rangeText()).toBeNull();
  });
});

describe('usuallyHint / checkHint', () => {
  it('words the active row and the out-of-range tag', () => {
    expect(usuallyHint(38, 44)).toBe('Usually 38–44″');
    expect(checkHint(14, 20)).toBe('Check: usually 14–20″');
  });

  it('shows no hint without a range', () => {
    expect(usuallyHint(null, null)).toBeNull();
    expect(checkHint(null, null)).toBe('Check this value');
  });
});

describe('the dock (Save set and progress)', () => {
  it('asks before saving a set with empty items, without blocking', () => {
    expect(emptyItemsPrompt(10, 12)).toBe('2 items still empty. Save anyway?');
    expect(emptyItemsPrompt(11, 12)).toBe('1 item still empty. Save anyway?');
  });

  it('saves straight away when every item is filled', () => {
    expect(emptyItemsPrompt(12, 12)).toBeNull();
  });

  it('fills the progress bar by share of items filled', () => {
    expect(filledShare(7, 12)).toBeCloseTo(0.583, 3);
    expect(filledShare(0, 0)).toBe(0);
    expect(filledShare(12, 12)).toBe(1);
  });
});
