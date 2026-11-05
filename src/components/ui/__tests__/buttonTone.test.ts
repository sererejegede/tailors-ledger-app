import { colors, radius } from '@/theme/tokens';
import { buttonTone, textActionColor } from '../buttonTone';

describe('the four kinds of button', () => {
  it('fills the main action with maroon', () => {
    expect(buttonTone('primary')).toEqual({ background: colors.accent, border: colors.accent, label: '#FFFFFF' });
  });

  it('marks focus with a maroon border on white', () => {
    expect(buttonTone('focus')).toEqual({ background: colors.surface, border: colors.accent, label: colors.accent });
  });

  it('keeps maroon off plain buttons', () => {
    const tone = buttonTone('plain');
    expect([tone.background, tone.border, tone.label]).not.toContain(colors.accent);
  });

  it('greys out any kind when disabled', () => {
    expect(buttonTone('primary', true)).toEqual(buttonTone('plain', true));
    expect(buttonTone('primary', true).label).toBe(colors.faint);
  });

  it('draws text actions grey, and red for void and delete', () => {
    expect(textActionColor()).toBe(colors.muted);
    expect(textActionColor(true)).toBe(colors.danger);
  });
});

describe('the three corner sizes', () => {
  it('are round, 16 for cards and 24 for sheets', () => {
    expect([radius.round, radius.card, radius.sheet]).toEqual([999, 16, 24]);
  });
});
