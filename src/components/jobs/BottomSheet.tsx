import { useEffect, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme/tokens';
import { Portal } from '@/components/OverlayHost';
import { useKeyboardHeight } from '@/components/ui/useKeyboardHeight';

/** How long a sheet takes to slide up: brief, so it never holds up the tailor. */
const OPEN_MS = 200;

/**
 * A sheet up from the bottom, in the thumb zone; it slides up as it opens. In-tree through
 * the Portal rather than a <Modal>, whose separate window eats the first tap while the
 * keyboard is up. Mount it to open it.
 */
type Props = { onClose: () => void; children: ReactNode };

export function BottomSheet({ onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => back.remove();
  }, [onClose]);

  return (
    <Portal>
      <View style={styles.overlay}>
        <Animated.View style={styles.scrim} entering={FadeIn.duration(OPEN_MS)}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.duration(OPEN_MS)}
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg, marginBottom: kbHeight }]}
        >
          {children}
        </Animated.View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(27,26,23,0.45)',
  },
  fill: { flex: 1 },
  sheet: {
    backgroundColor: colors.dockBg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.md,
  },
});
