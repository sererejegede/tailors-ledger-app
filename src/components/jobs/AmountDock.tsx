import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { buttonLabel, fonts } from '@/theme/typography';
import { NumberPad } from '@/components/NumberPad';

/**
 * The payment pad (S9b): the measuring pad, with ,000 / Half / All where ¼ ½ ¾ sit. An
 * amount is two taps (45 then ,000). The chosen chip gets the 1px maroon border, and Save
 * lives in the pad's bottom-right cell.
 */
type Props = {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onThousands: () => void;
  onHalf: () => void;
  onAll: () => void;
  /** The chip that fills in everything left, "All". */
  allLabel: string;
  /** Lit while the amount is exactly what the chip gives, so the tailor sees which they picked. */
  halfActive?: boolean;
  allActive?: boolean;
  onSave: () => void;
};

function AmountDockBase({
  onDigit,
  onDelete,
  onThousands,
  onHalf,
  onAll,
  allLabel,
  halfActive,
  allActive,
  onSave,
}: Props) {
  return (
    <View style={styles.dock}>
      <View style={styles.chips}>
        <Chip label=",000" onPress={onThousands} />
        <Chip label="Half" onPress={onHalf} active={halfActive} />
        <Chip label={allLabel} onPress={onAll} active={allActive} />
      </View>
      <NumberPad onPress={onDigit} onDelete={onDelete} onNext={onSave} saveMode />
    </View>
  );
}

function Chip({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: { gap: space.sm },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent },
  chipLabel: { fontFamily: fonts.semibold, ...buttonLabel(fontSizes.base), color: colors.text },
  chipLabelActive: { color: colors.accent },
});

export const AmountDock = memo(AmountDockBase);
