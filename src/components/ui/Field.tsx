import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';

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

/** A labelled text field (S11a, S11b, S13): the label above, a round field below. */
export function Field({ label, area, mono, prefix, error, flex, ...input }: Props) {
  return (
    <View style={[styles.wrap, flex && styles.flex]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, area && styles.area, error ? styles.boxError : null]}>
        {prefix ? <Text style={[styles.prefix, mono && valueText]}>{prefix}</Text> : null}
        <TextInput
          {...input}
          style={[styles.input, mono && styles.mono, area && styles.areaInput]}
          placeholderTextColor={colors.faint}
          multiline={area}
          accessibilityLabel={label}
        />
      </View>
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
  boxError: { borderColor: colors.danger },
  prefix: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.faint },
  input: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 0,
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  mono: { ...valueText, fontSize: fontSizes.base },
  areaInput: { minHeight: 64, lineHeight: 22, textAlignVertical: 'top', paddingVertical: space.xs },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: space.xs },
});
