import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/tokens';

/** On, then off, for this long each: a text field's blink. */
const BLINK_MS = 530;

type Props = {
  /** About the height of the digits it sits beside. */
  height: number;
  color?: string;
};

/**
 * A blinking caret showing where the number pad is typing: the active row while measuring,
 * the one-item sheet, a price on New job and Job detail, and the payment amount. Hidden
 * from screen readers; it's only a visual cue.
 */
export function Cursor({ height, color = colors.accent }: Props) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withDelay(BLINK_MS, withTiming(0, { duration: 0 })),
        withDelay(BLINK_MS, withTiming(1, { duration: 0 })),
      ),
      -1,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[styles.caret, { height, backgroundColor: color }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  caret: { width: 2, borderRadius: 1, marginHorizontal: 1 },
});
