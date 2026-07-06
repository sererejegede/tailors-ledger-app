import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import type { EditItem } from '@/features/templates/useTemplateEditor';
import MenuIcon from '@/assets/icons/menu-01.svg';
import TrashIcon from '@/assets/icons/trash-01.svg';

/**
 * Template item list with drag-to-reorder by the ☰ handle and swipe-to-delete.
 *
 * Position is driven by an `order` shared value (ids in display order) owned entirely on
 * the UI thread — NOT by the React array index. Rows are rendered in a stable order and
 * absolutely positioned at `order.indexOf(id) * ROW_H`. Dragging rewrites `order` live so
 * the other rows ease open a gap; on release we persist via onReorder. Because rendering
 * never depends on the array index, the data reorder can't race the animation (the cause
 * of the post-drop flicker).
 */
const ROW_H = 64;

function rangeLabel(it: EditItem): string {
  if (it.minRange != null && it.maxRange != null) return `${it.minRange}–${it.maxRange}″`;
  if (it.minRange != null) return `≥ ${it.minRange}″`;
  if (it.maxRange != null) return `≤ ${it.maxRange}″`;
  return '';
}

type Props = {
  items: EditItem[];
  onReorder: (from: number, to: number) => void;
  onEdit: (item: EditItem) => void;
  onRemove: (item: EditItem) => void;
  // Mount the per-row gesture handlers only once true — gating until the screen's open
  // animation settles avoids the mount stutter on first paint.
  interactive?: boolean;
  // One-time affordance: briefly open+close the top row's swipe action so the otherwise
  // invisible swipe-to-delete gesture is discoverable (paired with the editor coach-mark).
  nudgeFirst?: boolean;
};

export function DraggableTemplateItems({
  items,
  onReorder,
  onEdit,
  onRemove,
  interactive = true,
  nudgeFirst = false,
}: Props) {
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
    // Otherwise mirror the data order exactly. (Appending unknown ids at the bottom — the
    // old behavior — sent a RESTORED undo item to the end even though its DB position is
    // correct; a fresh drop is already reflected in both `order` and `items`, so this stays
    // a no-op there.)
    order.value = ids;
  }, [items, order, activeId]);

  const stableItems = useMemo(
    () => [...items].sort((a, b) => (a.id < b.id ? -1 : 1)),
    [items],
  );

  // Accent-tinted marker at the slot the dragged row will land in (the gap), shown only
  // while dragging. Snaps to each slot as the drag crosses boundaries.
  const dropStyle = useAnimatedStyle(() => {
    const dragging = activeId.value !== null;
    if (!dragging) return { opacity: 0 };
    const slot = order.value.indexOf(activeId.value as string);
    return { opacity: 1, transform: [{ translateY: slot * ROW_H }] };
  });

  return (
    <View style={styles.card}>
      <View style={{ height: items.length * ROW_H }}>
        <Animated.View pointerEvents="none" style={[styles.dropZone, dropStyle]} />
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
            nudge={nudgeFirst && item.id === items[0]?.id}
            onReorder={onReorder}
            onEdit={() => onEdit(item)}
            onRemove={() => onRemove(item)}
          />
        ))}
      </View>
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
  nudge: boolean;
  onReorder: (from: number, to: number) => void;
  onEdit: () => void;
  onRemove: () => void;
};

function Row({ item, count, order, activeId, startSlot, dragY, interactive, nudge, onReorder, onEdit, onRemove }: RowProps) {
  const id = item.id;
  const started = useSharedValue(false);
  const swipeRef = useRef<SwipeableMethods>(null);
  const nudged = useRef(false);

  // Fire the swipe-affordance peek once, after the row is interactive (Swipeable mounted).
  useEffect(() => {
    if (!nudge || !interactive || nudged.current) return;
    nudged.current = true;
    const open = setTimeout(() => swipeRef.current?.openRight(), 450);
    const close = setTimeout(() => swipeRef.current?.close(), 1350);
    return () => {
      clearTimeout(open);
      clearTimeout(close);
    };
  }, [nudge, interactive]);

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

  const aStyle = useAnimatedStyle(() => {
    const active = activeId.value === id;
    const slot = order.value.indexOf(id);
    if (active) {
      return {
        transform: [{ translateY: startSlot.value * ROW_H + dragY.value }, { rotate: '1deg' }],
        zIndex: 50,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
      };
    }
    const y = slot * ROW_H;
    if (!started.value) {
      started.value = true;
      return { transform: [{ translateY: y }, { scale: 1 }], zIndex: 0, elevation: 0, shadowOpacity: 0 };
    }
    return {
      transform: [{ translateY: withTiming(y, { duration: 160 }) }, { scale: 1 }],
      zIndex: 0,
      elevation: 0,
      shadowOpacity: 0,
    };
  });

  const inner = (
    <View style={styles.rowInner}>
      <Pressable style={styles.content} onPress={onEdit}>
        <Text style={styles.key} numberOfLines={1}>
          {item.key}
        </Text>
        <Text style={styles.range}>{rangeLabel(item)}</Text>
      </Pressable>
      {interactive ? (
        <GestureDetector gesture={pan}>
          <MenuIcon width={20} height={20} color={colors.faint} style={styles.handle} />
        </GestureDetector>
      ) : (
        <MenuIcon width={20} height={20} color={colors.faint} style={styles.handle} />
      )}
    </View>
  );

  return (
    <Animated.View style={[styles.rowAbs, aStyle]}>
      {interactive ? (
        <Swipeable
          ref={swipeRef}
          renderRightActions={() => (
            <Pressable style={styles.remove} onPress={onRemove}>
              <TrashIcon width={20} height={20} color="#fff" />
            </Pressable>
          )}
          overshootRight={false}
        >
          {inner}
        </Swipeable>
      ) : (
        inner
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  rowAbs: { position: 'absolute', left: 0, right: 0, height: ROW_H },
  dropZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: space.xs,
    height: ROW_H,
    backgroundColor: colors.accentTint,
  },
  rowInner: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  content: { flex: 1 },
  key: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.text },
  range: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
  remove: {
    height: '100%',
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  handle: { padding: space.md },
});
