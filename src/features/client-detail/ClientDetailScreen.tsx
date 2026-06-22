import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import type Client from '@/db/models/Client';
import type MeasurementSet from '@/db/models/MeasurementSet';
import { getClient, updateClient } from '@/repositories/clients';
import { setsForClient, createSetFromTemplate } from '@/repositories/sets';
import { getDefaultTemplateId } from '@/repositories/templates';
import { getRelativeTime } from '@/lib/time';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { PromptModal } from '@/components/PromptModal';
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientDetail'>;
type Edit = { field: 'name' | 'phone' | 'comment'; value: string; error?: string } | null;

const FIELD_META = {
  name: { title: 'Client name', placeholder: 'Name' },
  phone: { title: 'Phone', placeholder: 'Phone number' },
  comment: { title: 'Note', placeholder: 'e.g. prefers a relaxed fit, no tight collars' },
} as const;

export default function ClientDetailScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const [client, setClient] = useState<Client | null>(null);
  const [sets, setSets] = useState<MeasurementSet[]>([]);
  const [edit, setEdit] = useState<Edit>(null);

  const load = useCallback(async () => {
    const c = await getClient(database, clientId);
    setClient(c);
    setSets(await setsForClient(database, clientId));
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: client?.name || 'Client' });
  }, [navigation, client?.name]);

  const submitEdit = useCallback(
    async (value: string) => {
      if (!edit) return;
      const trimmed = value.trim();
      if (edit.field === 'name' && !trimmed) {
        setEdit({ ...edit, error: 'Name is required.' });
        return;
      }
      try {
        await updateClient(database, clientId, { [edit.field]: trimmed });
        setEdit(null);
        load();
      } catch (e) {
        setEdit({ ...edit, error: e instanceof Error ? e.message : String(e) });
      }
    },
    [edit, clientId, load],
  );

  const newSet = useCallback(async () => {
    const templateId = await getDefaultTemplateId(database);
    const set = await createSetFromTemplate(database, { clientId, templateId });
    navigation.navigate('MeasurementEntry', { setId: set.id });
  }, [clientId, navigation]);

  if (!client) return <View style={styles.screen} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* phone */}
      <Pressable style={styles.fieldRow} onPress={() => setEdit({ field: 'phone', value: client.phone ?? '' })}>
        <Text style={styles.fieldLabel}>Phone</Text>
        <Text style={[styles.fieldValue, !client.phone && styles.placeholder]}>
          {client.phone || 'Add phone'}
        </Text>
      </Pressable>

      {/* comment / note */}
      <Pressable
        style={styles.noteCard}
        onPress={() => setEdit({ field: 'comment', value: client.comment ?? '' })}
      >
        <Text style={styles.fieldLabel}>Note</Text>
        <Text style={[styles.noteText, !client.comment && styles.placeholder]}>
          {client.comment || 'Add a note — general preferences, fit, anything.'}
        </Text>
      </Pressable>

      <Pressable style={styles.rename} onPress={() => setEdit({ field: 'name', value: client.name })}>
        <Text style={styles.renameText}>Rename client</Text>
      </Pressable>

      {/* sets */}
      <View style={styles.setsHeader}>
        <Text style={styles.sectionTitle}>Measurement sets</Text>
        <Text style={styles.count}>{sets.length}</Text>
      </View>

      <Pressable style={styles.newSet} onPress={newSet}>
        <Text style={styles.newSetText}>＋ New measurement set</Text>
      </Pressable>

      {sets.length === 0 ? (
        <Text style={styles.empty}>No sets yet — start a new measurement set.</Text>
      ) : (
        sets.map((set) => (
          <Pressable
            key={set.id}
            style={styles.setRow}
            onPress={() => navigation.navigate('SetDetail', { setId: set.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.setLabel} numberOfLines={1}>
                {set.label || set.templateNameSnapshot || 'Measurement set'}
              </Text>
              <Text style={styles.setMeta}>{getRelativeTime(set.updatedAt)}</Text>
            </View>
            <ChevronIcon width={20} height={20} color={colors.faint} />
          </Pressable>
        ))
      )}

      <PromptModal
        visible={edit != null}
        title={edit ? FIELD_META[edit.field].title : ''}
        placeholder={edit ? FIELD_META[edit.field].placeholder : ''}
        initialValue={edit?.value ?? ''}
        submitLabel="Save"
        error={edit?.error}
        onCancel={() => setEdit(null)}
        onSubmit={submitEdit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  fieldValue: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
  placeholder: { color: colors.faint },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: space.xs,
  },
  noteText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, lineHeight: 21 },
  rename: { alignSelf: 'flex-start', paddingVertical: space.xs },
  renameText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent },
  setsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  sectionTitle: { fontFamily: fonts.titleSemi, fontSize: 18, color: colors.text },
  count: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  newSet: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.default,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  newSetText: { fontFamily: fonts.bold, fontSize: 15, color: colors.accent },
  empty: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, paddingVertical: space.md },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  setLabel: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  setMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
});
