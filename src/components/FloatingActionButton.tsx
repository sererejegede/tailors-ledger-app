import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/theme/tokens';
import PlusIcon from '@/assets/icons/plus.svg';
import { fonts } from '@/theme/typography';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  label?: string;
};

function FloatingActionButtonBase({ onPress, accessibilityLabel, label }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      style={[styles.fab, { bottom: insets.bottom + space.lg }, label ? styles.withLabel : styles.size]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <PlusIcon width={28} height={28} color="#fff" />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: space.lg,
    right: space.lg,
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
  size: { width: 60, height: 60 },
  withLabel: {
    padding: space.md,
    paddingInlineEnd: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.title, fontSize: 18, color: '#fff', fontWeight: '700' },
});

export const FloatingActionButton = memo(FloatingActionButtonBase);
