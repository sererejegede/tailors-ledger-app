import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database, Tables } from '@/db';
import type MeasurementSet from '@/db/models/MeasurementSet';
import type MeasurementItem from '@/db/models/MeasurementItem';
import type MeasurementValue from '@/db/models/MeasurementValue';
import { setItems, updateSet } from '@/repositories/sets';
import { earlierValuesByItem } from '@/repositories/items';
import { formatInches } from '@/lib/units';
import { getRelativeTime } from '@/lib/time';
import { colors, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { PromptModal } from '@/components/PromptModal';
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SetDetail'>;

export default function SetDetailScreen({ route, navigation }: Props) {
  const { setId } = route.params;
  const [set, setSet] = useState<MeasurementSet | null>(null);
  const [items, setItems_] = useState<MeasurementItem[]>([]);
  const [editingNote, setEditingNote] = useState(false);
  // Earlier values per item (current excluded), preloaded with the items in one query so
  // we know up front which rows carry history (badge) and can show the panel instantly.
  const [history, setHistory] = useState<Record<string, MeasurementValue[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const s = await database.get<MeasurementSet>(Tables.measurementSets).find(setId);
    setSet(s);
    const rows = await setItems(database, setId);
    setItems_(rows);
    setHistory(await earlierValuesByItem(database, rows.map((r) => r.id)));
  }, [setId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: set?.label || set?.templateNameSnapshot || 'Set' });
  }, [navigation, set?.label, set?.templateNameSnapshot]);

  const toggleItem = useCallback((itemId: string) => {
    setExpanded((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  const saveNote = useCallback(
    async (value: string) => {
      await updateSet(database, setId, { note: value.trim() });
      setEditingNote(false);
      load();
    },
    [setId, load],
  );

  if (!set) return <View style={styles.screen} />;

  const filled = items.filter((i) => i.currentValue != null).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {filled} of {items.length} measured
        </Text>
        <Pressable
          style={styles.remeasure}
          onPress={() => navigation.navigate('MeasurementEntry', { setId })}
        >
          <Text style={styles.remeasureText}>Re-measure</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {items.map((item, i) => {
          const earlier = history[item.id] ?? [];
          const hasHistory = earlier.length > 0;
          const isOpen = hasHistory && !!expanded[item.id];
          const divider = i === items.length - 1 ? undefined : styles.rowDivider;
          return (
            <View key={item.id} style={divider}>
              {/* Only rows with earlier values are interactive; the rest are inert taps. */}
              <Pressable
                style={styles.itemRow}
                disabled={!hasHistory}
                onPress={() => toggleItem(item.id)}
              >
                <Text style={styles.itemKey} numberOfLines={1}>
                  {item.key}
                </Text>
                <View style={styles.itemRight}>
                  {hasHistory ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{earlier.length}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.itemValue, item.currentValue == null && styles.itemEmpty]}>
                    {formatInches(item.currentValue ?? null)}
                  </Text>
                  {hasHistory ? (
                    <ChevronIcon
                      width={18}
                      height={18}
                      color={colors.faint}
                      style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
                    />
                  ) : null}
                </View>
              </Pressable>

              {isOpen ? (
                <View style={styles.histPanel}>
                  {earlier.map((v) => (
                    <View key={v.id} style={styles.histRow}>
                      <Text style={styles.histWhen}>{getRelativeTime(v.recordedAt)}</Text>
                      <Text style={styles.histValue}>{formatInches(v.value)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Pressable style={styles.noteCard} onPress={() => setEditingNote(true)}>
        <Text style={styles.noteLabel}>Note</Text>
        <Text style={[styles.noteText, !set.note && styles.placeholder]}>
          {set.note || 'Add a note for this set.'}
        </Text>
      </Pressable>

      <PromptModal
        visible={editingNote}
        title="Set note"
        placeholder="e.g. wants extra room at the tummy"
        initialValue={set.note ?? ''}
        submitLabel="Save"
        onCancel={() => setEditingNote(false)}
        onSubmit={saveNote}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  remeasure: {
    backgroundColor: colors.accent,
    borderRadius: radius.default,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  remeasureText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  itemKey: { fontFamily: fonts.medium, fontSize: 16, color: colors.text, flexShrink: 1 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  itemValue: { ...valueText, fontSize: 17, color: colors.text },
  itemEmpty: { color: colors.faint },
  // history badge — count of earlier values on rows that have any
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.accent },
  // inline history accordion (earlier values only; current is on the row)
  histPanel: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    paddingTop: space.xs,
    gap: space.xs,
    backgroundColor: colors.dockBg,
  },
  histRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histWhen: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  histValue: { ...valueText, fontSize: 15, color: colors.muted },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: space.xs,
  },
  noteLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  noteText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, lineHeight: 21 },
  placeholder: { color: colors.faint },
});
