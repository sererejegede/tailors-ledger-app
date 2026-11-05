import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { Button } from '@/components/ui';
import { filledShare } from '@/lib/measureHints';
import { FracChips, Frac } from './FracChips';
import { NumberPad } from './NumberPad';

/** The count ticks up, and the bar grows, this fast. */
const TICK_MS = 160;

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
  const share = useSharedValue(filledShare(filled, total));
  useEffect(() => {
    share.value = withTiming(filledShare(filled, total), { duration: TICK_MS });
  }, [filled, total, share]);
  const barStyle = useAnimatedStyle(() => ({ width: `${share.value * 100}%` }));

  return (
    <View style={styles.dock}>
      <View style={styles.top}>
        <View style={styles.progress} accessible accessibilityLabel={`${filled} of ${total} filled`}>
          <View style={styles.countRow}>
            {/* Keyed by the count, so each new value ticks up into place. */}
            <Animated.Text key={filled} entering={FadeInDown.duration(TICK_MS)} style={styles.countNum}>
              {filled}
            </Animated.Text>
            <Text style={styles.count}> of {total} filled</Text>
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.bar, barStyle]} />
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
  countRow: { flexDirection: 'row', alignItems: 'baseline' },
  count: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text },
  countNum: { ...valueText, fontSize: fontSizes.base, color: colors.text },
  track: { height: 4, borderRadius: radius.round, backgroundColor: colors.line, marginTop: 6, overflow: 'hidden' },
  bar: { height: 4, borderRadius: radius.round, backgroundColor: colors.text },
  save: { minHeight: 44, paddingHorizontal: 20 },
});

export const Dock = memo(DockBase);
