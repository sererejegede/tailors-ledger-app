import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/theme/tokens';
import PlusIcon from '@/assets/icons/plus.svg';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
};

function FloatingActionButtonBase({ onPress, accessibilityLabel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      style={[styles.fab, { bottom: insets.bottom + space.lg }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <PlusIcon width={28} height={28} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: space.lg,
    right: space.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
});

export const FloatingActionButton = memo(FloatingActionButtonBase);
