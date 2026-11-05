import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import type { EditItem } from '@/features/templates/useTemplateEditor';
import GripIcon from '@/assets/icons/dots-grip.svg';
import ChevronIcon from '@/assets/icons/chevron-right.svg';

/**
 * S13's item list: every item shown, a visible ⋮⋮ handle at the left of each row to drag
 * it to a new place, and a tap on the row to rename it, set its range or delete it.
 *
 * Position is driven by an `order` shared value (ids in display order) owned entirely on
 * the UI thread — NOT by the React array index. Rows are rendered in a stable order and
 * absolutely positioned at `order.indexOf(id) * ROW_H`. Dragging rewrites `order` live so
 * the other rows ease open a gap; on release we persist via onReorder. Because rendering
 * never depends on the array index, the data reorder can't race the animation (the cause
 * of the post-drop flicker).
 */
const ROW_H = 52;

/** "14–18″", "≥ 14″", or "No range". */
export function rangeLabel(it: Pick<EditItem, 'minRange' | 'maxRange'>): string {
  if (it.minRange != null && it.maxRange != null) return `${it.minRange}–${it.maxRange}″`;
  if (it.minRange != null) return `≥ ${it.minRange}″`;
  if (it.maxRange != null) return `≤ ${it.maxRange}″`;
  return 'No range';
}

type Props = {
  items: EditItem[];
  onReorder: (from: number, to: number) => void;
  onEdit: (item: EditItem) => void;
  // Mount the per-row drag handlers only once true — gating until the screen's open
  // animation settles avoids the mount stutter on first paint.
  interactive?: boolean;
};

export function DraggableTemplateItems({ items, onReorder, onEdit, interactive = true }: Props) {
  const order = useSharedValue<string[]>(items.map((i) => i.id));
  const activeId = useSharedValue<string | null>(null);
  const startSlot = useSharedValue(0);
  const dragY = useSharedValue(0);

  // Keep `order` reconciled with the data. Render in a stable, id-sorted order so React
  // never reorders the rows — positions come from `order`, not child order.
  useEffect(() => {
    const ids = items.map((i) => i.id);
    // Mid-drag: don't disturb the live UI-thread order; just drop any ids that vanished.
    if (activeId.value !== null) {
      const present = new Set(ids);
      order.value = order.value.filter((id) => present.has(id));
      return;
    }
    // Otherwise mirror the data order exactly (a restored item lands back in its place).
    order.value = ids;
  }, [items, order, activeId]);

  const stableItems = useMemo(() => [...items].sort((a, b) => (a.id < b.id ? -1 : 1)), [items]);

  return (
    <View style={{ height: items.length * ROW_H }}>
      {stableItems.map((item) => (
        <Row
          key={item.id}
          item={item}
          count={items.length}
          order={order}
          activeId={activeId}
          startSlot={startSlot}
          dragY={dragY}
          interactive={interactive}
          onReorder={onReorder}
          onEdit={() => onEdit(item)}
        />
      ))}
    </View>
  );
}

type RowProps = {
  item: EditItem;
  count: number;
  order: SharedValue<string[]>;
  activeId: SharedValue<string | null>;
  startSlot: SharedValue<number>;
  dragY: SharedValue<number>;
  interactive: boolean;
  onReorder: (from: number, to: number) => void;
  onEdit: () => void;
};

function Row({ item, count, order, activeId, startSlot, dragY, interactive, onReorder, onEdit }: RowProps) {
  const id = item.id;
  const started = useSharedValue(false);

  const pan = Gesture.Pan()
    .onStart(() => {
      activeId.value = id;
      startSlot.value = order.value.indexOf(id);
      dragY.value = 0;
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      let hovered = startSlot.value + Math.round(e.translationY / ROW_H);
      if (hovered < 0) hovered = 0;
      if (hovered > count - 1) hovered = count - 1;
      const cur = order.value.indexOf(id);
      if (hovered !== cur) {
        const next = [...order.value];
        next.splice(cur, 1);
        next.splice(hovered, 0, id);
        order.value = next;
      }
    })
    .onEnd(() => {
      const to = order.value.indexOf(id);
      const from = startSlot.value;
      if (to !== from) runOnJS(onReorder)(from, to);
      activeId.value = null;
      dragY.value = 0;
    });

  // The row being dragged lifts: white, rounded, with a soft shadow, and no line under it.
  const aStyle = useAnimatedStyle(() => {
    const active = activeId.value === id;
    const slot = order.value.indexOf(id);
    if (active) {
      return {
        transform: [{ translateY: startSlot.value * ROW_H + dragY.value - 2 }],
        zIndex: 50,
        elevation: 8,
        shadowOpacity: 0.12,
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        borderBottomWidth: 0,
      };
    }
    const y = slot * ROW_H;
    const base = { zIndex: 0, elevation: 0, shadowOpacity: 0, backgroundColor: colors.bg, borderRadius: 0, borderBottomWidth: 1 };
    if (!started.value) {
      started.value = true;
      return { ...base, transform: [{ translateY: y }] };
    }
    return { ...base, transform: [{ translateY: withTiming(y, { duration: 160 }) }] };
  });

  const grip = (
    <View style={styles.grip} accessibilityRole="adjustable" accessibilityLabel={`Reorder ${item.key}`}>
      <GripIcon width={18} height={18} color={colors.muted} />
    </View>
  );

  const range = rangeLabel(item);
  return (
    <Animated.View style={[styles.row, aStyle]}>
      {interactive ? <GestureDetector gesture={pan}>{grip}</GestureDetector> : grip}
      <Pressable
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${item.key}, ${range}`}
      >
        <Text style={styles.key} numberOfLines={1}>
          {item.key}
        </Text>
        <Text style={[styles.range, range !== 'No range' && styles.mono]}>{range}</Text>
        <ChevronIcon width={18} height={18} color={colors.faint} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomColor: colors.line,
    shadowColor: '#14120F',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  grip: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.xs },
  pressed: { opacity: 0.6 },
  key: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.text },
  range: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  mono: valueText,
});
