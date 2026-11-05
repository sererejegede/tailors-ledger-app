import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '@/components/jobs/BottomSheet';
import { Button } from '@/components/ui';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

export type ClientField = {
  key: 'name' | 'phone' | 'comment';
  label: string;
  value: string;
  placeholder?: string;
  /** Save stays off while this one is empty. */
  required?: boolean;
};

type Props = {
  title: string;
  fields: ClientField[];
  /** Shown under the fields, e.g. a duplicate name. */
  error?: string;
  onClose: () => void;
  onSave: (values: Partial<Record<ClientField['key'], string>>) => void;
};

/**
 * Edits a client from Client detail (S2): the name and phone together, or the
 * preferences on their own. A sheet in the thumb zone; mount it to open it.
 */
export function ClientEditSheet({ title, fields, error, onClose, onSave }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );
  const ready = fields.every((f) => !f.required || values[f.key].trim().length > 0);
  const save = () => {
    if (ready) onSave(Object.fromEntries(fields.map((f) => [f.key, values[f.key].trim()])));
  };

  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      {fields.map((f, i) => {
        const multiline = f.key === 'comment';
        return (
          <View key={f.key} style={styles.field}>
            {fields.length > 1 ? <Text style={styles.label}>{f.label}</Text> : null}
            <TextInput
              style={[styles.input, multiline && styles.area, error && f.key === 'name' ? styles.inputError : null]}
              value={values[f.key]}
              onChangeText={(text) => setValues((v) => ({ ...v, [f.key]: text }))}
              placeholder={f.placeholder}
              placeholderTextColor={colors.faint}
              autoFocus={i === 0}
              multiline={multiline}
              autoCapitalize={f.key === 'name' ? 'words' : 'sentences'}
              autoCorrect={multiline}
              keyboardType={f.key === 'phone' ? 'phone-pad' : 'default'}
              inputMode={f.key === 'phone' ? 'tel' : 'text'}
              returnKeyType={multiline ? 'default' : 'done'}
              onSubmitEditing={multiline ? undefined : save}
              accessibilityLabel={f.label}
            />
          </View>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button kind="primary" label="Save" onPress={save} disabled={!ready} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.titleSemi, fontSize: 22, color: colors.text },
  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.muted },
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
