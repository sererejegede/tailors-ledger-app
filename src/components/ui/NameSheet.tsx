import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '@/components/jobs/BottomSheet';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { Button } from './Button';

type Props = {
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel: string;
  /** Shown under the field, e.g. a duplicate name. */
  error?: string;
  /** A note: several lines, sentence case. */
  multiline?: boolean;
  /** Save may be tapped with the field empty (clearing a note). */
  optional?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
};

/**
 * A one-field sheet from the bottom (rule 5: small edits open near the thumb). Mount it
 * to open it. The button stays off until something is typed.
 */
export function NameSheet({
  title,
  placeholder,
  initialValue = '',
  submitLabel,
  error,
  multiline,
  optional,
  onClose,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const ready = optional || value.trim().length > 0;
  const submit = () => {
    if (ready) onSubmit(value.trim());
  };

  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      <TextInput
        style={[styles.input, multiline ? styles.area : null, error ? styles.inputError : null]}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        autoFocus
        multiline={multiline}
        autoCapitalize={multiline ? 'sentences' : 'words'}
        autoCorrect={!!multiline}
        returnKeyType={multiline ? 'default' : 'done'}
        onSubmitEditing={multiline ? undefined : submit}
        accessibilityLabel={title}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button kind="primary" label={submitLabel} onPress={submit} disabled={!ready} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.titleSemi, fontSize: 22, color: colors.text },
  input: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  area: {
    minHeight: 112,
    paddingVertical: space.md,
    borderRadius: radius.card,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  inputError: { borderColor: colors.danger },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: -space.xs },
  actions: { flexDirection: 'row', marginTop: space.xs },
});
