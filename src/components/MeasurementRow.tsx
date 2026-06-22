import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { formatInches } from '@/lib/units';

/**
 * One row of the measurement list: item name + current value. Tapping makes it the
 * active item (left accent bar + tint). A subtle dot marks values edited this session
 * so the tailor can sanity-check before saving (spec §5).
 */
type Props = {
  itemKey: string;
  value: number | null;
  active: boolean;
  changed: boolean;
  onPress: () => void;
};

function MeasurementRowBase({ itemKey, value, active, changed, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, active && styles.rowActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {active && <View style={styles.bar} />}
      <Text style={[styles.key, active && styles.keyActive]} numberOfLines={1}>
        {itemKey}
      </Text>
      <View style={styles.right}>
        {changed && <View style={styles.dot} />}
        <Text style={[styles.val, value == null && styles.valEmpty]}>{formatInches(value)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bg,
  },
  rowActive: { backgroundColor: colors.accentTint },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  key: { fontFamily: fonts.medium, fontSize: 16, color: colors.text, flexShrink: 1 },
  keyActive: { fontFamily: fonts.semibold, color: colors.accentInk },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  val: { ...valueText, fontSize: 17, color: colors.text },
  valEmpty: { color: colors.faint },
});

export const MeasurementRow = memo(MeasurementRowBase);
