import { Pressable, View, Text, StyleSheet } from "react-native";
import { memo } from "react";
import type MeasurementSet from "@/db/models/MeasurementSet";
import { getRelativeTime } from "@/lib/time";
import { colors, space } from "@/theme/tokens";
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import { fonts } from "@/theme/typography";

type Props = {
  set: MeasurementSet;
  itemsCount: number;
  onPress: () => void;
};
function ClientDetailSetRowBase({ set, itemsCount, onPress }: Props) {
  return (
    <Pressable
      key={set.id}
      style={styles.setRow}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.setLabel} numberOfLines={1}>
          {set.label || set.templateNameSnapshot || 'Measurement set'}
        </Text>
        <View style={styles.setMetaContainer}>
          <Text style={styles.setMeta}>{getRelativeTime(set.updatedAt)}</Text>
          <Text style={styles.setMeta}>•</Text>
          <Text style={styles.setMeta}>{itemsCount} item{itemsCount === 1 ? '' : 's'} measured</Text>
        </View>
      </View>
      <ChevronIcon width={20} height={20} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  setLabel: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  setMetaContainer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  setMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});

export const ClientDetailSetRow = memo(ClientDetailSetRowBase);
