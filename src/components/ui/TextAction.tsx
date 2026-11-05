import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { textActionColor } from './buttonTone';

type Props = {
  label: string;
  onPress: () => void;
  /** Red, for void and delete. */
  danger?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** A small text action: grey and underlined ("Change", "Rename", "View all 5 jobs"). */
export function TextAction({ label, onPress, danger, accessibilityLabel, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
      style={({ pressed }) => [styles.action, pressed ? styles.pressed : null, style]}
    >
      <Text style={[styles.label, { color: textActionColor(danger) }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  pressed: { opacity: 0.6 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    textDecorationLine: 'underline',
  },
});
