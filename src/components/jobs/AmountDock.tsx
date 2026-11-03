import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { buttonLabel, fonts } from '@/theme/typography';
import { NumberPad } from '@/components/NumberPad';

/**
 * The money pad: the measuring pad, with ,000 / Half / All where ¼ ½ ¾ sit. A price is
 * two taps (45 then ,000). Save lives in the pad's bottom-right cell.
 */
type Props = {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onThousands: () => void;
  onHalf: () => void;
  onAll: () => void;
  /** "All" on a new job, "Balance" on an existing one. */
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
    borderRadius: radius.default,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accentTint, borderColor: colors.accent },
  chipLabel: { fontFamily: fonts.bold, ...buttonLabel(fontSizes.base), color: colors.text },
  chipLabelActive: { color: colors.accentInk },
});

export const AmountDock = memo(AmountDockBase);
