import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import type Client from '@/db/models/Client';
import { getClient, updateClient } from '@/repositories/clients';
import { jobsForClient, totalOwedMinor, type JobSummary } from '@/repositories/jobs';
import { setsForClient, type MeasurementSetWithItemsCount } from '@/repositories/sets';
import { getDefaultTemplateId } from '@/repositories/templates';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { buttonLabel, fonts } from '@/theme/typography';
import { PromptModal } from '@/components/PromptModal';
import EditIcon from '@/assets/icons/edit-02.svg';
import RulerIcon from '@/assets/icons/ruler.svg';
import type { RootStackParamList } from '@/navigation/types';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { formatPhone } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import PhoneIcon from '@/assets/icons/phone.svg';
import { ClientDetailSetRow } from '@/components/ClientDetailSetRow';
import { ClientDetailJobRow } from '@/components/ClientDetailJobRow';

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
  const [sets, setSets] = useState<MeasurementSetWithItemsCount[]>([]);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [edit, setEdit] = useState<Edit>(null);

  const load = useCallback(async () => {
    const c = await getClient(database, clientId);
    setClient(c);
    setSets(await setsForClient(database, clientId));
    setJobs(await jobsForClient(database, clientId));
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

  // Client-first: open the hero with template + client; the set is created only on save
  // (createSetWithMeasurements), so backing out leaves no empty set behind.
  const newSet = useCallback(async () => {
    const templateId = await getDefaultTemplateId(database);
    navigation.navigate('MeasurementEntry', { templateId, clientId });
  }, [clientId, navigation]);

  if (!client) return <View style={styles.screen} />;

  const owedMinor = totalOwedMinor(jobs);

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
        <View>
          {sets.map(({ set, itemsCount }) => (
            <ClientDetailSetRow
              key={set.id}
              set={set}
              itemsCount={itemsCount}
              onPress={() => navigation.navigate('SetDetail', { setId: set.id })}
            />
          ))}
        </View>
      )}

      {/* jobs */}
      {jobs.length ? (
        <>
          <View style={styles.jobsHeader}>
            <Text style={styles.jobsTitle}>Jobs</Text>
            <Text style={styles.owed}>
              {owedMinor ? `${formatMoney(owedMinor, jobs[0].job.currency)} owed` : 'Nothing owed'}
            </Text>
          </View>
          <View style={styles.jobs}>
            {jobs.map((summary) => (
              <ClientDetailJobRow
                key={summary.job.id}
                summary={summary}
                onPress={() => navigation.navigate('JobDetail', { jobId: summary.job.id })}
              />
            ))}
          </View>
        </>
      ) : null}

      <Pressable
        style={styles.recordPayment}
        onPress={() => navigation.navigate('RecordPayment', { clientId })}
        accessibilityRole="button"
      >
        <Text style={styles.recordPaymentText}>Record payment</Text>
      </Pressable>

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
        inputMode={edit?.field === 'phone' ? 'tel' : 'text'}
        keyboardType={edit?.field === 'phone' ? 'phone-pad' : 'default'}
        onCancel={() => setEdit(null)}
        onSubmit={submitEdit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingTop: space.sm, gap: space.md, minHeight: '100%' },
  name: { fontFamily: fonts.title, fontSize: fontSizes['3xl'], color: colors.text, textAlign: 'center' },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -space.xs,
  },
  phoneGlyph: { fontSize: fontSizes.sm, color: colors.muted },
  phone: { fontFamily: fonts.body, fontSize: fontSizes.base },
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
    fontSize: fontSizes.sm,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text,
  },
  count: { marginLeft: 'auto', fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
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
    fontSize: fontSizes.base,
    lineHeight: 24,
    color: colors.text,
    paddingRight: space.xl,
  },
  notePlaceholder: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.faint, lineHeight: 22 },
  newSet: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.default,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  newSetText: { fontFamily: fonts.bold, ...buttonLabel(fontSizes.base), color: colors.accent },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.muted, paddingVertical: space.md },
  divider: { height: 2, backgroundColor: colors.accent, marginVertical: space.lg },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginLeft: 'auto',
  },
  editText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.accent },
  jobsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // More room above the bar than below it, so it reads as the heading of the jobs under it.
    marginTop: space.xl,
    marginHorizontal: -space.sm,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.accentTint,
  },
  jobsTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accentInk,
  },
  owed: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.accent },
  // Each row has its own 14px top padding, so pull the list up under the bar.
  jobs: { marginTop: -space.sm },
  // The bottom margin keeps the full-width button clear of the floating +.
  recordPayment: {
    height: 48,
    marginTop: space.xs,
    marginBottom: 96,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordPaymentText: { fontFamily: fonts.bold, ...buttonLabel(fontSizes.base), color: colors.accent },
});
