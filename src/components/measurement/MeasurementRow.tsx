import { memo, useEffect } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { formatInches } from '@/lib/units';

/**
 * One row of the measurement list: item name + value. Rows are VARIABLE height — the
 * active row grows (in-place value + bigger label), the rest stay compact.
 *
 * The size is driven by a per-row `prog` shared value (0 = inactive, 1 = active) animated
 * with `withTiming`, and EVERYTHING that changes between states (paddingVertical, label /
 * value font size + line height, tint, accent bar) interpolates from it. This is what
 * makes the transition symmetric: when the active item changes, the new row animates 0→1
 * AND the previous row animates 1→0 with the same timing, so it shrinks back smoothly
 * instead of snapping. (Earlier this relied on Reanimated's LinearTransition, which only
 * animated the row that grew.) The value is edited IN PLACE on the active row.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedText = Animated.Text;
const TINT_RGB = '246,231,236'; // colors.accentTint as rgb, faded by alpha
const DURATION = 120;

type Props = {
  itemKey: string;
  value: number | null;
  active: boolean;
  changed: boolean;
  /** Live value string for the active row (e.g. "16 ½″" or "—"); used only when active. */
  activeDisplay?: string;
  /** True when the active row is showing the existing/empty value (not actively typing). */
  activePlaceholder?: boolean;
  /** The committed value is outside the template item's expected range (soft warning). */
  warning?: boolean;
  onPress: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
};

function MeasurementRowBase({
  itemKey,
  value,
  active,
  changed,
  activeDisplay,
  activePlaceholder,
  warning,
  onPress,
  onLayout,
}: Props) {
  const prog = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    prog.value = withTiming(active ? 1 : 0, { duration: DURATION });
  }, [active, prog]);

  const rowStyle = useAnimatedStyle(() => ({
    paddingVertical: interpolate(prog.value, [0, 1], [space.md, space.xl]),
    backgroundColor: interpolateColor(
      prog.value,
      [0, 1],
      [`rgba(${TINT_RGB},0)`, `rgba(${TINT_RGB},1)`],
    ),
  }));
  const barStyle = useAnimatedStyle(() => ({ opacity: prog.value }));
  const keyStyle = useAnimatedStyle(() => ({ fontSize: interpolate(prog.value, [0, 1], [16, 20]) }));
  const valStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(prog.value, [0, 1], [17, 34]),
    lineHeight: interpolate(prog.value, [0, 1], [22, 38]),
  }));

  // Colors switch instantly (far less noticeable than a size/height snap).
  const valColor = active
    ? activePlaceholder
      ? colors.faint
      : colors.accentInk
    : value == null
      ? colors.faint
      : colors.text;

  return (
    <AnimatedPressable
      onPress={onPress}
      onLayout={onLayout}
      style={[styles.row, rowStyle]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.View pointerEvents="none" style={[styles.bar, barStyle]} />
      <AnimatedText
        style={[styles.key, active && styles.keyActive, keyStyle]}
        numberOfLines={1}
      >
        {itemKey}
      </AnimatedText>
      <View style={styles.right}>
        {warning && !active && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>!</Text>
          </View>
        )}
        {changed && !active && <View style={styles.dot} />}
        <AnimatedText style={[styles.val, { color: valColor }, valStyle]}>
          {active ? activeDisplay : formatInches(value)}
        </AnimatedText>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: 'transparent',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.accent },
  key: { fontFamily: fonts.medium, color: colors.text, flexShrink: 1 },
  keyActive: { fontFamily: fonts.semibold, color: colors.accentInk },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  warn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnText: { fontFamily: fonts.bold, fontSize: 11, color: '#fff', lineHeight: 14 },
  val: { ...valueText },
});

export const MeasurementRow = memo(MeasurementRowBase);
