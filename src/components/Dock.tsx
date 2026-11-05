import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { Button } from '@/components/ui';
import { filledShare } from '@/lib/measureHints';
import { FracChips, Frac } from './FracChips';
import { NumberPad } from './NumberPad';

/**
 * The docked input, fixed in the thumb zone. Its top line holds "7 of 12 filled", a
 * progress bar and a solid **Save set**; under it the fraction chips and the number pad,
 * with Next in the pad's bottom-right cell. The value being entered shows IN PLACE on the
 * active row (see MeasurementRow). It never scrolls away during one-handed use.
 */
type Props = {
  frac: Frac;
  filled: number;
  total: number;
  onFrac: (f: Frac) => void;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onNext: () => void;
  onSave: () => void;
};

function DockBase({ frac, filled, total, onFrac, onDigit, onDelete, onNext, onSave }: Props) {
  return (
    <View style={styles.dock}>
      <View style={styles.top}>
        <View style={styles.progress} accessible accessibilityLabel={`${filled} of ${total} filled`}>
          <Text style={styles.count}>
            <Text style={styles.countNum}>{filled}</Text> of {total} filled
          </Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${filledShare(filled, total) * 100}%` }]} />
          </View>
        </View>
        <Button kind="primary" size="small" label="Save set" onPress={onSave} style={styles.save} />
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
    paddingTop: space.sm,
    paddingBottom: 20,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 48, marginBottom: space.xs },
  progress: { flex: 1 },
  count: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text },
  countNum: { ...valueText, fontSize: fontSizes.base, color: colors.text },
  track: { height: 4, borderRadius: radius.round, backgroundColor: colors.line, marginTop: 6, overflow: 'hidden' },
  bar: { height: 4, borderRadius: radius.round, backgroundColor: colors.text },
  save: { minHeight: 44, paddingHorizontal: 20 },
});

export const Dock = memo(DockBase);
