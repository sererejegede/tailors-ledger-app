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
  style?: StyleProp<ViewStyle>;
};

/**
 * A full-height, fully round button. In a `BottomBar` each one takes an equal share of
 * the width, so two buttons sit side by side.
 */
export function Button({ label, onPress, kind = 'plain', disabled, Icon, children, accessibilityLabel, style }: Props) {
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
        { backgroundColor: tone.background, borderColor: tone.border },
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      {Icon ? <Icon width={20} height={20} color={tone.label} /> : null}
      <Text style={[styles.label, { color: tone.label }]} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fonts.bold, ...buttonLabel(fontSizes.base) },
});
