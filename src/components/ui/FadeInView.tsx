import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/** Brief, so a list never feels slower to arrive than it is. */
const FADE_MS = 180;

/**
 * Fades a list in once, when its data first arrives (it mounts in place of the spinner).
 * Reloads on refocus don't fade again, since the view stays mounted.
 */
export function FadeInView({ children }: { children: ReactNode }) {
  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(FADE_MS)}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
