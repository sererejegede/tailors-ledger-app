import { colors } from '@/theme/tokens';

/**
 * The four kinds of button (CLAUDE-app.md "Screen rules"):
 * - `primary`: solid maroon, the screen's main action (Save, Create job, Record payment);
 * - `focus`: a 1px maroon border, for what has focus (the pad's Next, the chosen chip);
 * - `plain`: every other button;
 * - text actions are a separate component, `TextAction`.
 */
export type ButtonKind = 'primary' | 'focus' | 'plain';

export type ButtonTone = { background: string; border: string; label: string };

export function buttonTone(kind: ButtonKind, disabled = false): ButtonTone {
  if (disabled) return { background: colors.surface, border: colors.line, label: colors.faint };
  switch (kind) {
    case 'primary':
      return { background: colors.accent, border: colors.accent, label: '#FFFFFF' };
    case 'focus':
      return { background: colors.surface, border: colors.accent, label: colors.accent };
    case 'plain':
      return { background: colors.surface, border: colors.line2, label: colors.text };
  }
}

/** Grey underlined text; red for void and delete. */
export function textActionColor(danger = false): string {
  return danger ? colors.danger : colors.muted;
}
