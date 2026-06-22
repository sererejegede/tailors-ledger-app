import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { formatInches } from '@/lib/units';

/**
 * One row of the measurement list: item name + current value. The active highlight
 * (left accent bar + tint) is drawn by an animated overlay in the entry screen that
 * slides between rows, so the row itself stays transparent and a fixed height
 * (ROW_HEIGHT) — that uniform height is what lets the overlay and auto-scroll position
 * by index. A subtle dot marks values edited this session (spec §5).
 */
export const ROW_HEIGHT = 56;

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
      style={styles.row}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
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
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: 'transparent',
  },
  key: { fontFamily: fonts.medium, fontSize: 16, color: colors.text, flexShrink: 1 },
  keyActive: { fontFamily: fonts.semibold, color: colors.accentInk },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  val: { ...valueText, fontSize: 17, color: colors.text },
  valEmpty: { color: colors.faint },
});

export const MeasurementRow = memo(MeasurementRowBase);
