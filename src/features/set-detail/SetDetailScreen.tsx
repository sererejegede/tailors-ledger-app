import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database, Tables } from '@/db';
import type MeasurementSet from '@/db/models/MeasurementSet';
import type MeasurementItem from '@/db/models/MeasurementItem';
import { setItems, updateSet } from '@/repositories/sets';
import { formatInches } from '@/lib/units';
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

  const load = useCallback(async () => {
    const s = await database.get<MeasurementSet>(Tables.measurementSets).find(setId);
    setSet(s);
    setItems_(await setItems(database, setId));
  }, [setId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: set?.label || set?.templateNameSnapshot || 'Set' });
  }, [navigation, set?.label, set?.templateNameSnapshot]);

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
        <Pressable style={styles.remeasure} onPress={() => navigation.navigate('MeasurementEntry', { setId })}>
          <Text style={styles.remeasureText}>Re-measure</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {items.map((item, i) => (
          <Pressable
            key={item.id}
            style={[styles.itemRow, i === items.length - 1 && styles.itemRowLast]}
            onPress={() => navigation.navigate('ItemHistory', { itemId: item.id, itemKey: item.key })}
          >
            <Text style={styles.itemKey} numberOfLines={1}>
              {item.key}
            </Text>
            <View style={styles.itemRight}>
              <Text style={[styles.itemValue, item.currentValue == null && styles.itemEmpty]}>
                {formatInches(item.currentValue ?? null)}
              </Text>
              <ChevronIcon width={18} height={18} color={colors.faint} />
            </View>
          </Pressable>
        ))}
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
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemRowLast: { borderBottomWidth: 0 },
  itemKey: { fontFamily: fonts.medium, fontSize: 16, color: colors.text, flexShrink: 1 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  itemValue: { ...valueText, fontSize: 17, color: colors.text },
  itemEmpty: { color: colors.faint },
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
