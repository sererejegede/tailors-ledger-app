import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { BottomSheet } from '@/components/jobs/BottomSheet';
import { Button, TextAction } from '@/components/ui';
import XCloseIcon from '@/assets/icons/x-close.svg';
import type { ItemDraft } from '@/features/templates/useTemplateEditor';

/**
 * Add or edit one template item, in a sheet from the bottom: its name, an optional usual
 * range (the soft "Usually …" check while measuring) and Save. An item already on the
 * template can be deleted from here too. Renders nothing while `draft` is null.
 */
type Props = {
  draft: ItemDraft | null;
  onChange: (patch: Partial<ItemDraft>) => void;
  onCancel: () => void;
  onSave: () => void;
  /** Existing items only. */
  onDelete?: () => void;
};

export function TemplateItemEditor({ draft, onChange, onCancel, onSave, onDelete }: Props) {
  const maxRef = useRef<TextInput>(null);
  if (!draft) return null;
  const ready = draft.key.trim().length > 0;

  return (
    <BottomSheet onClose={onCancel}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {draft.id ? 'Edit item' : 'Add item'}
        </Text>
        <Pressable onPress={onCancel} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
          <XCloseIcon width={22} height={22} color={colors.text} />
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        value={draft.key}
        onChangeText={(t) => onChange({ key: t })}
        placeholder="Item name, e.g. Sleeve length"
        placeholderTextColor={colors.faint}
        autoFocus
        autoCapitalize="sentences"
        autoCorrect={false}
        accessibilityLabel="Item name"
      />
      <View>
        <Text style={styles.label}>Usual range in inches (optional)</Text>
        <View style={styles.range}>
          <TextInput
            style={[styles.input, styles.rangeInput]}
            value={draft.min}
            onChangeText={(t) => onChange({ min: t })}
            placeholder="From"
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => maxRef.current?.focus()}
            accessibilityLabel="Range from"
          />
          <Text style={styles.dash}>–</Text>
          <TextInput
            ref={maxRef}
            style={[styles.input, styles.rangeInput]}
            value={draft.max}
            onChangeText={(t) => onChange({ max: t })}
            placeholder="To"
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            accessibilityLabel="Range to"
          />
        </View>
      </View>
      <View style={styles.actions}>
        <Button kind="primary" label="Save" onPress={onSave} disabled={!ready} />
      </View>
      {draft.id && onDelete ? (
        <TextAction label="Delete item" danger onPress={onDelete} style={styles.delete} />
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -space.sm },
  title: { fontFamily: fonts.titleSemi, fontSize: 22, color: colors.text },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginBottom: 6 },
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
  range: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rangeInput: { flex: 1, ...valueText, fontSize: fontSizes.base },
  dash: { fontFamily: fonts.body, fontSize: fontSizes.lg, color: colors.muted },
  actions: { flexDirection: 'row', marginTop: space.xs },
  delete: { alignSelf: 'center', marginTop: -space.xs },
});
