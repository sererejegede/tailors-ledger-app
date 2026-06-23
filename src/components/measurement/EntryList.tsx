import { useCallback, useEffect, useRef } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { MeasurementRow } from '@/components/measurement/MeasurementRow';
import type { EntryRow } from '@/features/measurement-entry/useMeasurementEntry';

/**
 * The scrollable item list (the body of the hero). Owns the scroll bookkeeping and keeps
 * the active row in view as the dock auto-advances through items.
 */
type Props = {
  rows: EntryRow[];
  active: number;
  dockDisplay: string;
  dockPlaceholder: boolean;
  onTapRow: (i: number) => void;
  onAddItem: () => void;
};

export function EntryList({ rows, active, dockDisplay, dockPlaceholder, onTapRow, onAddItem }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0); // current scroll offset
  const viewportH = useRef(0); // visible height of the list
  // Row offsets/heights, kept in a ref (NOT state): the rows animate their padding every
  // frame, so onLayout fires continuously — writing to a ref avoids a re-render storm, and
  // the scroll runs only on an active-item change.
  const rowLayouts = useRef<{ y: number; h: number }[]>([]);

  const onRowLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    rowLayouts.current[index] = { y, h: height };
  }, []);

  // Keep the active row scrolled into view, but only when it isn't already (fires once per
  // active-item change; reads the latest measured layout from the ref).
  useEffect(() => {
    const l = rowLayouts.current[active];
    if (!l || viewportH.current === 0) return;
    const margin = 12;
    const top = l.y;
    const bottom = l.y + l.h;
    const visibleTop = scrollY.current;
    const visibleBottom = scrollY.current + viewportH.current;
    if (top < visibleTop + margin) {
      scrollRef.current?.scrollTo({ y: Math.max(0, top - margin), animated: true });
    } else if (bottom > visibleBottom - margin) {
      scrollRef.current?.scrollTo({ y: bottom - viewportH.current + margin, animated: true });
    }
  }, [active]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.list}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
      }}
      onLayout={(e) => {
        viewportH.current = e.nativeEvent.layout.height;
      }}
    >
      <View>
        {rows.map((r, i) => (
          <MeasurementRow
            key={r.itemId}
            itemKey={r.key}
            value={r.value}
            active={i === active}
            changed={r.changed}
            activeDisplay={dockDisplay}
            activePlaceholder={dockPlaceholder}
            onPress={() => onTapRow(i)}
            onLayout={(e) => onRowLayout(i, e)}
          />
        ))}
        <Pressable style={styles.addRow} onPress={onAddItem}>
          <Text style={styles.addText}>＋ Add item</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  addRow: { paddingVertical: space.md, paddingHorizontal: space.lg },
  addText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accent },
});
