import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { FracChips, Frac } from './FracChips';
import { NumberPad } from './NumberPad';

/**
 * The docked input, fixed in the thumb zone (wireframe `.dock`). The value being entered
 * is shown IN PLACE on the active row (see MeasurementRow), so the dock itself is just
 * the fraction chips + number pad. It never scrolls away during one-handed use.
 */
type Props = {
  frac: Frac;
  onFrac: (f: Frac) => void;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onNext: () => void;
};

function DockBase({ frac, onFrac, onDigit, onDelete, onNext }: Props) {
  return (
    <View style={styles.dock}>
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
});

export const Dock = memo(DockBase);
