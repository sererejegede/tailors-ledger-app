import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { bufferToMinor, minorToBuffer } from '@/lib/amountEntry';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import MinusIcon from '@/assets/icons/minus.svg';
import PlusIcon from '@/assets/icons/plus.svg';
import { BottomSheet } from './BottomSheet';

/**
 * Add or edit one cloth on a job: description, how many, and which measurement set it's
 * made from. The price is here only on Job detail; on a new job it comes from the pad.
 */

export type JobItemDraft = {
  description: string;
  quantity: number;
  unitPriceMinor: number | null;
  setId: string | null;
};

type Props = {
  initial?: JobItemDraft;
  sets: { id: string; name: string }[];
  withPrice?: boolean;
  onSave: (item: JobItemDraft) => void;
  onRemove?: () => void;
  onClose: () => void;
};

export function JobItemSheet({ initial, sets, withPrice, onSave, onRemove, onClose }: Props) {
  const [description, setDescription] = useState(initial?.description ?? '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [price, setPrice] = useState(minorToBuffer(initial?.unitPriceMinor ?? 0));
  const [setId, setSetId] = useState(initial?.setId ?? null);
  const [error, setError] = useState<string>();

  const save = () => {
    const trimmed = description.trim();
    if (!trimmed) {
      setError('Say what the item is.');
      return;
    }
    const unitPriceMinor = withPrice
      ? price
        ? bufferToMinor(price)
        : null
      : (initial?.unitPriceMinor ?? null);
    onSave({ description: trimmed, quantity, unitPriceMinor, setId });
  };

  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.title}>{initial ? 'Edit item' : 'Add item'}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholder="Agbada, 3-piece"
        placeholderTextColor={colors.faint}
        value={description}
        onChangeText={(text) => {
          setDescription(text);
          setError(undefined);
        }}
        autoFocus={!initial}
        autoCorrect={false}
        returnKeyType="done"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.row}>
        <Text style={styles.label}>How many</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.step}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            accessibilityRole="button"
            accessibilityLabel="One less"
          >
            <MinusIcon width={20} height={20} color={colors.text} />
          </Pressable>
          <Text style={styles.quantity}>{quantity}</Text>
          <Pressable
            style={styles.step}
            onPress={() => setQuantity((q) => q + 1)}
            accessibilityRole="button"
            accessibilityLabel="One more"
          >
            <PlusIcon width={20} height={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {withPrice ? (
        <View style={styles.row}>
          <Text style={styles.label}>Price of one</Text>
          <TextInput
            style={[styles.input, styles.priceInput]}
            placeholder="Not priced"
            placeholderTextColor={colors.faint}
            value={price}
            onChangeText={(text) => setPrice(text.replace(/\D/g, '').slice(0, 9))}
            keyboardType="numeric"
            inputMode="numeric"
          />
        </View>
      ) : null}

      {sets.length ? (
        <View style={styles.setsBlock}>
          <Text style={styles.label}>Measurement set</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
            <View style={styles.sets}>
              {[{ id: null, name: 'None' }, ...sets].map((option) => {
                const on = option.id === setId;
                return (
                  <Pressable
                    key={option.id ?? 'none'}
                    style={[styles.set, on && styles.setOn]}
                    onPress={() => setSetId(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.setText, on && styles.setTextOn]} numberOfLines={1}>
                      {option.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.actions}>
        {onRemove ? (
          <Pressable style={styles.remove} onPress={onRemove} accessibilityRole="button">
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.save} onPress={save} accessibilityRole="button">
          <Text style={styles.saveText}>{initial ? 'Save' : 'Add'}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.title, fontSize: fontSizes.xl, color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.danger },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  label: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: { ...valueText, fontSize: fontSizes.xl, color: colors.text, minWidth: 28, textAlign: 'center' },
  priceInput: { flex: 1, maxWidth: 180, textAlign: 'right', ...valueText },
  setsBlock: { gap: space.sm },
  sets: { flexDirection: 'row', gap: space.sm },
  set: {
    maxWidth: 200,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
  },
  setOn: { backgroundColor: colors.accentTint, borderColor: colors.accent },
  setText: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  setTextOn: { color: colors.accentInk },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  remove: { height: 52, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.danger },
  save: {
    flex: 1,
    height: 52,
    borderRadius: radius.default,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: '#fff' },
});
