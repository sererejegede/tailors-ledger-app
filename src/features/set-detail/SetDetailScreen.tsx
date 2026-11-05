import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert } from '@/lib/alert';
import { database } from '@/db';
import type MeasurementSet from '@/db/models/MeasurementSet';
import type MeasurementItem from '@/db/models/MeasurementItem';
import type MeasurementValue from '@/db/models/MeasurementValue';
import { getSet, setItems, softDeleteSet, updateSet } from '@/repositories/sets';
import { earlierValuesByItem, quickEditItem } from '@/repositories/items';
import { formatInches } from '@/lib/units';
import { setMetaLine, setTitle } from '@/lib/setDetail';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { BottomBar, Button, NameSheet, ScreenHeader, SectionLabel, TextAction } from '@/components/ui';
import { ItemSheet } from '@/components/ItemSheet';
import { SetImages } from '@/components/SetImages';
import HistoryIcon from '@/assets/icons/clock-rewind.svg';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SetDetail'>;
type Editing = 'label' | 'note' | null;

/**
 * S6. Every item in full, as on the paper card: tap a row to open it (S7) for a new value
 * and its history; a small count shows how many earlier values it has. Then the note, the
 * photos and *Delete this set*, with *Re-measure* at the bottom.
 */
export default function SetDetailScreen({ route, navigation }: Props) {
  const { setId } = route.params;
  const [set, setSet] = useState<MeasurementSet | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [items, setItems_] = useState<MeasurementItem[]>([]);
  // Earlier values per item (current excluded), loaded with the items in one query.
  const [history, setHistory] = useState<Record<string, MeasurementValue[]>>({});
  const [openItem, setOpenItem] = useState<MeasurementItem | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  const load = useCallback(async () => {
    const { set, client } = await getSet(database, setId);
    setSet(set);
    setClientName(client);
    const rows = await setItems(database, setId);
    setItems_(rows);
    setHistory(await earlierValuesByItem(database, rows.map((r) => r.id)));
  }, [setId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveItem = useCallback(
    async (value: number) => {
      if (!openItem) return;
      await quickEditItem(database, openItem.id, value);
      setOpenItem(null);
      load();
    },
    [openItem, load],
  );

  const saveText = useCallback(
    async (value: string) => {
      const field = editing;
      setEditing(null);
      if (field === 'label') await updateSet(database, setId, { label: value.trim() });
      else if (field === 'note') await updateSet(database, setId, { note: value.trim() });
      load();
    },
    [editing, setId, load],
  );

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete this set?', 'Its measurements and photos are removed from this client.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await softDeleteSet(database, setId);
          navigation.goBack();
        },
      },
    ]);
  }, [setId, navigation]);

  const closeItem = useCallback(() => setOpenItem(null), []);
  const closeEditing = useCallback(() => setEditing(null), []);

  if (!set) return <View style={styles.screen} />;

  const filled = items.filter((i) => i.currentValue != null).length;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={setTitle(set.label, set.templateNameSnapshot)} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{setMetaLine(clientName, set.templateNameSnapshot, set.updatedAt.getTime())}</Text>
          <TextAction label={set.label ? 'Rename' : 'Add label'} onPress={() => setEditing('label')} />
        </View>

        <SectionLabel title="Measurements" aside={`${filled} of ${items.length}`} />
        {items.map((item, i) => {
          const earlier = history[item.id]?.length ?? 0;
          return (
            <Pressable
              key={item.id}
              onPress={() => setOpenItem(item)}
              style={({ pressed }) => [styles.item, i === items.length - 1 && styles.last, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${item.key}, ${formatInches(item.currentValue ?? null)}${
                earlier ? `, ${earlier} earlier value${earlier === 1 ? '' : 's'}` : ''
              }`}
            >
              <Text style={styles.key} numberOfLines={1}>
                {item.key}
              </Text>
              <View style={styles.hist}>
                {earlier > 0 ? (
                  <>
                    <HistoryIcon width={14} height={14} color={colors.muted} />
                    <Text style={styles.histCount}>{earlier}</Text>
                  </>
                ) : null}
              </View>
              <Text style={[styles.value, item.currentValue == null && styles.empty]}>
                {formatInches(item.currentValue ?? null)}
              </Text>
            </Pressable>
          );
        })}

        <SectionLabel title="Note" />
        <Pressable
          style={({ pressed }) => [styles.note, pressed && styles.pressed]}
          onPress={() => setEditing('note')}
          accessibilityRole="button"
          accessibilityLabel={set.note ? `Note: ${set.note}. Edit note` : 'Add a note'}
        >
          <Text style={[styles.noteText, !set.note && styles.placeholder]}>{set.note || 'Add a note for this set'}</Text>
        </Pressable>

        <SetImages setId={setId} />

        <TextAction label="Delete this set" danger onPress={confirmDelete} style={styles.delete} />
      </ScrollView>

      <BottomBar>
        <Button kind="primary" label="Re-measure" onPress={() => navigation.navigate('MeasurementEntry', { setId })} />
      </BottomBar>

      {openItem ? (
        <ItemSheet
          itemKey={openItem.key}
          current={openItem.currentValue ?? null}
          currentAt={openItem.currentValueAt ?? null}
          earlier={(history[openItem.id] ?? []).map((v) => ({ id: v.id, value: v.value, recordedAt: v.recordedAt }))}
          onClose={closeItem}
          onSave={saveItem}
        />
      ) : null}

      {editing === 'label' ? (
        <NameSheet
          title={set.label ? 'Rename set' : 'Add label'}
          placeholder="e.g. Wedding agbada"
          initialValue={set.label ?? ''}
          submitLabel="Save"
          onClose={closeEditing}
          onSubmit={saveText}
        />
      ) : null}
      {editing === 'note' ? (
        <NameSheet
          title="Note"
          placeholder="e.g. wants extra room at the tummy"
          initialValue={set.note ?? ''}
          submitLabel="Save"
          multiline
          optional
          onClose={closeEditing}
          onSubmit={saveText}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  meta: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.7 },
  key: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.text },
  hist: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 28 },
  histCount: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.muted },
  value: { ...valueText, fontSize: fontSizes.base, color: colors.text },
  empty: { color: colors.faint },
  note: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: space.md,
  },
  noteText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
  placeholder: { color: colors.muted },
  delete: { marginTop: space.lg },
});
