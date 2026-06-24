import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * One row in the template editor's item list: key + range, with up/down reorder and remove.
 */
type Props = {
  item: { key: string; minRange?: number; maxRange?: number };
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function rangeLabel(it: Props['item']): string {
  if (it.minRange != null && it.maxRange != null) return `${it.minRange}–${it.maxRange}″`;
  if (it.minRange != null) return `≥ ${it.minRange}″`;
  if (it.maxRange != null) return `≤ ${it.maxRange}″`;
  return 'no range';
}

export function TemplateItemRow({ item, isFirst, isLast, onEdit, onMoveUp, onMoveDown, onRemove }: Props) {
  return (
    <View style={[styles.itemRow, isLast && styles.itemRowLast]}>
      <Pressable style={{ flex: 1 }} onPress={onEdit}>
        <Text style={styles.itemKey}>{item.key}</Text>
        <Text style={styles.itemRange}>{rangeLabel(item)}</Text>
      </Pressable>
      <View style={styles.controls}>
        <Pressable onPress={onMoveUp} hitSlop={8} disabled={isFirst}>
          <Text style={[styles.ctrl, isFirst && styles.ctrlOff]}>↑</Text>
        </Pressable>
        <Pressable onPress={onMoveDown} hitSlop={8} disabled={isLast}>
          <Text style={[styles.ctrl, isLast && styles.ctrlOff]}>↓</Text>
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={styles.ctrlDelete}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemRowLast: { borderBottomWidth: 0 },
  itemKey: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  itemRange: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ctrl: { fontSize: 20, color: colors.muted, width: 22, textAlign: 'center' },
  ctrlOff: { color: colors.line2 },
  ctrlDelete: { fontSize: 16, color: colors.danger, width: 22, textAlign: 'center' },
});
