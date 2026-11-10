import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { fontSizes, radius, space } from '@/theme/tokens';
import { buttonLabel, fonts } from '@/theme/typography';
import { buttonTone, type ButtonKind } from './buttonTone';

type Props = {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  /** An icon drawn before the label, in the label's colour. */
  Icon?: ComponentType<SvgProps>;
  /** Extra content after the label, e.g. a count. */
  children?: ReactNode;
  accessibilityLabel?: string;
  /** `small` sits inline at its own width (Call, WhatsApp); the default fills its share of a bar. */
  size?: 'regular' | 'small';
  style?: StyleProp<ViewStyle>;
};

/**
 * A full-height, fully round button. In a `BottomBar` each one takes an equal share of
 * the width, so two buttons sit side by side.
 */
export function Button({
  label,
  onPress,
  kind = 'plain',
  disabled,
  Icon,
  children,
  accessibilityLabel,
  size = 'regular',
  style,
}: Props) {
  const small = size === 'small';
  const tone = buttonTone(kind, disabled);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        small ? styles.small : styles.fill,
        { backgroundColor: tone.background, borderColor: tone.border },
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      {Icon ? <Icon width={small ? 16 : 20} height={small ? 16 : 20} color={tone.label} /> : null}
      <Text style={[styles.label, small ? styles.smallLabel : null, { color: tone.label }]} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  fill: { flex: 1 },
  // No `flex` here: on the web `flex: 0` becomes CSS `0 1 0%`, which squeezes the button
  // down to its padding. Left unset, it's sized to its content on the web and on phones.
  small: { minHeight: 40, gap: 6 },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fonts.bold, ...buttonLabel(fontSizes.base) },
  smallLabel: { fontFamily: fonts.semibold, ...buttonLabel(fontSizes.sm) },
});
