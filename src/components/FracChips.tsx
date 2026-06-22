import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * The fraction row: three chips ¼ ½ ¾ (NO clear chip — clearing is a re-tap of the
 * active chip or the ⌫ key; PROGRESS.md brand decision). The active fraction is
 * highlighted with the accent.
 */
export type Frac = 0 | 0.25 | 0.5 | 0.75;
const CHIPS: { value: Exclude<Frac, 0>; label: string }[] = [
  { value: 0.25, label: '¼' },
  { value: 0.5, label: '½' },
  { value: 0.75, label: '¾' },
];

type Props = { value: Frac; onChange: (f: Frac) => void };

function FracChipsBase({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {CHIPS.map((chip) => {
        const active = value === chip.value;
        return (
          <Pressable
            key={chip.value}
            // re-tapping the active chip clears it (back to whole number)
            onPress={() => onChange(active ? 0 : chip.value)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${chip.label} fraction`}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, paddingBottom: space.sm },
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
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { fontFamily: fonts.semibold, fontSize: 20, color: colors.text },
  labelActive: { color: '#fff' },
});

export const FracChips = memo(FracChipsBase);
