import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type MeasurementSet from '@/db/models/MeasurementSet';
import { getRelativeTime } from '@/lib/time';
import { colors, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import ChevronIcon from '@/assets/icons/chevron-right.svg';

type Props = {
  set: MeasurementSet;
  /** Items with a value. */
  itemsCount: number;
  /** Every item in the set. */
  totalCount: number;
  last?: boolean;
  onPress: () => void;
};

/** A set on Client detail (S2): its name, then "Men's · 10 of 12 · 2 weeks ago". */
function ClientDetailSetRowBase({ set, itemsCount, totalCount, last, onPress }: Props) {
  const name = set.label || set.templateNameSnapshot || 'Measurement set';
  const meta = [
    set.label ? set.templateNameSnapshot : null,
    `${itemsCount} of ${totalCount}`,
    getRelativeTime(set.updatedAt),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${itemsCount} of ${totalCount} measured`}
    >
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <ChevronIcon width={18} height={18} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.6 },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
});

export const ClientDetailSetRow = memo(ClientDetailSetRowBase);
