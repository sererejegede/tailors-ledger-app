import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  /** False on a tab screen, where the tab bar already sits below and handles the inset. */
  safeBottom?: boolean;
};

/**
 * The bottom action bar: the screen's main action within thumb reach. Holds one or two
 * `Button`s, which share the width. Sits outside the screen's scroll view.
 */
export function BottomBar({ children, safeBottom = true }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: (safeBottom ? insets.bottom : 0) + space.xl }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
