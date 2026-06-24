import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { colors, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import type { EditItem } from '@/features/templates/useTemplateEditor';
import MenuIcon from '@/assets/icons/menu-01.svg';
import TrashIcon from '@/assets/icons/trash-01.svg';

/**
 * Template item list with drag-to-reorder by the ☰ handle. Fixed row height so the drop
 * index is `start + round(translationY / ROW_H)`. Minimal drag: the picked-up row follows
 * the finger and the list commits the new order on release (optimistically applied).
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
  // Mount the per-row gesture handlers (Swipeable + drag) only once true. Gating these
  // until the screen's open animation settles avoids the mount stutter on first paint.
  interactive?: boolean;
};

export function DraggableTemplateItems({
  items,
  onReorder,
  onEdit,
  onRemove,
  interactive = true,
}: Props) {
  const dragIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);
  return (
    <View style={styles.card}>
      {items.map((item, i) => (
        <Row
          key={item.id}
          item={item}
          index={i}
          count={items.length}
          dragIndex={dragIndex}
          dragY={dragY}
          interactive={interactive}
          onReorder={onReorder}
          onEdit={() => onEdit(item)}
          onRemove={() => onRemove(item)}
        />
      ))}
    </View>
  );
}

type RowProps = {
  item: EditItem;
  index: number;
  count: number;
  dragIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  interactive: boolean;
  onReorder: (from: number, to: number) => void;
  onEdit: () => void;
  onRemove: () => void;
};

function Row({ item, index, count, dragIndex, dragY, interactive, onReorder, onEdit, onRemove }: RowProps) {
  const pan = Gesture.Pan()
    .onStart(() => {
      dragIndex.value = index;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
    })
    .onEnd((e) => {
      let to = index + Math.round(e.translationY / ROW_H);
      if (to < 0) to = 0;
      if (to > count - 1) to = count - 1;
      if (to !== index) runOnJS(onReorder)(index, to);
      dragIndex.value = -1;
      dragY.value = 0;
    });

  const aStyle = useAnimatedStyle(() => {
    const active = dragIndex.value === index;
    return {
      transform: [{ translateY: active ? dragY.value : 0 }, { scale: active ? 1.03 : 1 }],
      zIndex: active ? 10 : 0,
      elevation: active ? 6 : 0,
      opacity: active ? 0.97 : 1,
    };
  });

  const row = (
    <Animated.View style={[styles.row, index === count - 1 && styles.rowLast, aStyle]}>
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
    </Animated.View>
  );

  // Until the screen settles, render the plain row (no native gesture mounts) so the
  // open animation stays smooth; the Swipeable/drag wire up a tick later.
  if (!interactive) return row;

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable style={styles.remove} onPress={onRemove}>
          <TrashIcon width={20} height={20} color="#fff" style={styles.removeIcon} />
        </Pressable>
      )}
      overshootRight={false}
    >
      {row}
    </Swipeable>
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
  row: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowLast: { borderBottomWidth: 0 },
  content: { flex: 1 },
  key: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  range: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  remove: { 
    height: '100%',
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  removeIcon: {},
  handle: { padding: space.md },
});
