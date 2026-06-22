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
import EditIcon from '@/assets/icons/edit-02.svg';
import RulerIcon from '@/assets/icons/ruler.svg';
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import type { RootStackParamList } from '@/navigation/types';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { formatPhone } from '@/lib/utils';
import PhoneIcon from '@/assets/icons/phone.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientDetail'>;
type Edit = { field: 'name' | 'phone' | 'comment'; value: string; error?: string } | null;

const FIELD_META = {
  name: { title: 'Client name', placeholder: 'Name' },
  phone: { title: 'Phone', placeholder: 'Phone number' },
  comment: { title: 'General preferences', placeholder: 'e.g. prefers a relaxed fit, no tight collars' },
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

  // Body shows the big centered name, so keep the native header to just the back arrow.
  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

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
      {/* identity */}
      <Pressable onPress={() => setEdit({ field: 'name', value: client.name })}>
        <Text style={styles.name}>{client.name || 'Unnamed'}</Text>
      </Pressable>
      <Pressable
        style={styles.phoneRow}
        onPress={() => setEdit({ field: 'phone', value: client.phone ?? '' })}
      >
        <PhoneIcon width={16} height={16} color={colors.text} />
        <Text style={[styles.phone, !client.phone && styles.placeholder]}>
          {formatPhone(client.phone ?? '') || 'Add phone number'}
        </Text>
      </Pressable>

      {/* general preferences */}
      <View
        style={styles.sectionHeader}
      >
        <Text style={styles.sectionTitle}>Customer preferences</Text>
        <Pressable style={styles.edit} onPress={() => setEdit({ field: 'comment', value: client.comment ?? '' })}>
          <Text style={styles.editText}>Edit</Text>
          <EditIcon width={17} height={17} color={colors.accent} />
        </Pressable>
      </View>
      <View style={styles.noteCard}>
        <Text style={[client.comment ? styles.noteText : styles.notePlaceholder]} numberOfLines={3}>
          {client.comment || 'Add general preferences — fit, fabric, anything.'}
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* measurement sets */}
      <View style={styles.sectionHeader}>
        <RulerIcon width={18} height={18} color={colors.text} />
        <Text style={styles.sectionTitle}>Measurement sets</Text>
        <Text style={styles.count}>{sets.length} Total</Text>
      </View>

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

      <FloatingActionButton
        onPress={newSet}
        accessibilityLabel="New measurement"
      />

      <PromptModal
        visible={edit != null}
        title={edit ? FIELD_META[edit.field].title : ''}
        placeholder={edit ? FIELD_META[edit.field].placeholder : ''}
        initialValue={edit?.value ?? ''}
        submitLabel="Save"
        error={edit?.error}
        multilineInput={edit?.field === 'comment'}
        onCancel={() => setEdit(null)}
        onSubmit={submitEdit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingTop: space.sm, gap: space.md, minHeight: '100%' },
  name: { fontFamily: fonts.title, fontSize: 30, color: colors.text, textAlign: 'center' },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -space.xs,
  },
  phoneGlyph: { fontSize: 14, color: colors.muted },
  phone: { fontFamily: fonts.body, fontSize: 16 },
  placeholder: { color: colors.faint },
  // section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text,
  },
  count: { marginLeft: 'auto', fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  noteCard: {
    backgroundColor: colors.accentTint,
    borderLeftWidth: 2,
    borderColor: colors.accent,
    padding: space.lg,
    paddingInlineStart: space.xxl,
    borderRadius: radius.default,
    overflow: 'hidden',
  },
  noteText: {
    fontFamily: fonts.italic,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    paddingRight: space.xl,
  },
  notePlaceholder: { fontFamily: fonts.body, fontSize: 15, color: colors.faint, lineHeight: 22 },
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
  divider: { height: 2, backgroundColor: colors.accent, marginVertical: space.lg },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginLeft: 'auto',
  },
  editText: { fontFamily: fonts.body, fontSize: 13, color: colors.accent },
});
