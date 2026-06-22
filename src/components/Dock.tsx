import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { FracChips, Frac } from './FracChips';
import { NumberPad } from './NumberPad';

/**
 * The docked input, fixed in the thumb zone (wireframe `.dock`). Shows the active item's
 * name + the value being entered (live), then the fraction chips and the number pad. It
 * never scrolls away during one-handed use.
 */
type Props = {
  itemKey: string;
  display: string; // formatted value, e.g. "16 ½″" or "—"
  placeholder: boolean; // true when showing the existing/empty value (not actively typing)
  frac: Frac;
  onFrac: (f: Frac) => void;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onNext: () => void;
};

function DockBase({ itemKey, display, placeholder, frac, onFrac, onDigit, onDelete, onNext }: Props) {
  return (
    <View style={styles.dock}>
      <View style={styles.disp}>
        <Text style={styles.key} numberOfLines={1}>
          {itemKey}
        </Text>
        <Text style={[styles.val, placeholder && styles.valPlaceholder]}>{display}</Text>
      </View>
      <FracChips value={frac} onChange={onFrac} />
      <NumberPad onPress={onDigit} onDelete={onDelete} onNext={onNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    borderTopWidth: 1,
    borderTopColor: colors.line2,
    backgroundColor: colors.dockBg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  disp: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
    paddingBottom: space.sm,
  },
  key: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, flexShrink: 1 },
  val: { ...valueText, fontSize: 32, color: colors.accentInk },
  valPlaceholder: { color: colors.faint, fontSize: 24 },
});

export const Dock = memo(DockBase);
