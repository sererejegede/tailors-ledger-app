import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme/tokens';
import { Portal } from '@/components/OverlayHost';

/**
 * A sheet up from the bottom, in the thumb zone. In-tree through the Portal rather than a
 * <Modal>, for the keyboard reasons in PromptModal. Mount it to open it.
 */
type Props = { onClose: () => void; children: ReactNode };

export function BottomSheet({ onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => {
      show.remove();
      hide.remove();
      back.remove();
    };
  }, [onClose]);

  return (
    <Portal>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg, marginBottom: kbHeight }]}>
          {children}
        </View>
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
  sheet: {
    backgroundColor: colors.dockBg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.md,
  },
});
