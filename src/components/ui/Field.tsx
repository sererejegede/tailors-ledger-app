import { type ReactNode } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { fonts, valueText } from '@/theme/typography';

/** How long the border takes to turn maroon (and back). */
const FOCUS_MS = 200;

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Several lines, in a card-cornered box. */
  area?: boolean;
  /** Numbers and phones: the tabular font. */
  mono?: boolean;
  /** Grey text inside the field before the value ("R-"). */
  prefix?: string;
  error?: string;
  /** Fills the row's width share (two fields side by side). */
  flex?: boolean;
};

/**
 * A labelled text field (S11a, S11b, S13): the label above, a round field below. The border
 * fades to maroon while it's being typed in (red while it shows an error).
 */
export function Field({ label, area, mono, prefix, error, flex, onFocus, onBlur, ...input }: Props) {
  const focus = useSharedValue(0);
  const border = useAnimatedStyle(() => ({
    borderColor: error ? colors.danger : interpolateColor(focus.value, [0, 1], [colors.line2, colors.accent]),
  }));
  return (
    <View style={[styles.wrap, flex && styles.flex]}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.box, area && styles.area, border]}>
        {prefix ? <Text style={[styles.prefix, mono && valueText]}>{prefix}</Text> : null}
        <TextInput
          {...input}
          onFocus={(e) => {
            focus.value = withTiming(1, { duration: FOCUS_MS });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.value = withTiming(0, { duration: FOCUS_MS });
            onBlur?.(e);
          }}
          style={[styles.input, mono && styles.mono, area && styles.areaInput]}
          placeholderTextColor={colors.faint}
          multiline={area}
          accessibilityLabel={label}
        />
      </Animated.View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** A field-shaped button that opens a picker (Currency). */
export function FieldButton({ label, children, flex }: { label: string; children: ReactNode; flex?: boolean }) {
  return (
    <View style={[styles.wrap, flex && styles.flex]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export const fieldBox = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.sm,
  minHeight: 48,
  marginTop: 6,
  paddingHorizontal: space.lg,
  borderWidth: 1,
  borderColor: colors.line2,
  borderRadius: radius.round,
  backgroundColor: colors.surface,
} as const;

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  flex: { flex: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  box: fieldBox,
  area: { alignItems: 'flex-start', borderRadius: radius.card, paddingVertical: space.sm },
  prefix: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.faint },
  input: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 0,
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text,
    // The browser's own focus ring is square and sits inside the round border; the border
    // shows focus instead.
    // (React Native's types leave out 'none', which the web needs.)
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null),
  },
  mono: { ...valueText, fontSize: fontSizes.base },
  areaInput: { minHeight: 64, lineHeight: 22, textAlignVertical: 'top', paddingVertical: space.xs },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: space.xs },
});
