import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { buttonLabel, fonts } from '@/theme/typography';
import { NumberPad } from '@/components/NumberPad';
import { TextAction } from '@/components/ui';

/**
 * The pad for one item's price (S8a): "Price of Iro and buba", then `,000`, `00` and Clear
 * where the measuring pad has ¼ ½ ¾, and Save in the pad's corner. It opens only when a
 * price is tapped and takes the place of the bottom bar.
 */
type Props = {
  itemName: string;
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onThousands: () => void;
  onDoubleZero: () => void;
  onClear: () => void;
  onSave: () => void;
  /** Job detail only: take the item off the job. Shown as a red link on the top line. */
  onRemove?: () => void;
};

function PriceDockBase({ itemName, onDigit, onDelete, onThousands, onDoubleZero, onClear, onSave, onRemove }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.dock, { paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.top}>
        <Text style={styles.label} numberOfLines={1}>
          Price of <Text style={styles.name}>{itemName.trim() || 'this item'}</Text>
        </Text>
        {onRemove ? <TextAction label="Remove item" danger onPress={onRemove} /> : null}
      </View>
      <View style={styles.chips}>
        <Chip label=",000" onPress={onThousands} />
        <Chip label="00" onPress={onDoubleZero} />
        <Chip label="Clear" onPress={onClear} />
      </View>
      <NumberPad onPress={onDigit} onDelete={onDelete} onNext={onSave} saveMode />
    </View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={styles.chipLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: {
    borderTopWidth: 1,
    borderTopColor: colors.line2,
    backgroundColor: colors.dockBg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  top: { height: 48, flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  label: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  name: { fontFamily: fonts.bold, color: colors.text },
  chips: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.line },
  chipLabel: { fontFamily: fonts.semibold, ...buttonLabel(fontSizes.base), color: colors.text },
});

export const PriceDock = memo(PriceDockBase);
