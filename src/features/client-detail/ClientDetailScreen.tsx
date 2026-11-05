import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import type Client from '@/db/models/Client';
import { DuplicateClientNameError, getClient, updateClient } from '@/repositories/clients';
import { jobRowsForClient } from '@/repositories/jobBoard';
import { totalOwedMinor } from '@/repositories/jobs';
import { setsForClient, type MeasurementSetWithItemsCount } from '@/repositories/sets';
import { getDefaultTemplateId } from '@/repositories/templates';
import type { JobRow } from '@/lib/jobBoard';
import { formatMoney } from '@/lib/money';
import { nowMs } from '@/lib/time';
import { formatPhone } from '@/lib/utils';
import { whatsappLink } from '@/lib/whatsapp';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { BottomBar, Button, ScreenHeader, SectionLabel, TextAction } from '@/components/ui';
import { ClientDetailSetRow } from '@/components/ClientDetailSetRow';
import { ClientDetailJobRow } from '@/components/ClientDetailJobRow';
import EditIcon from '@/assets/icons/edit-02.svg';
import PhoneIcon from '@/assets/icons/phone.svg';
import ChatIcon from '@/assets/icons/message-circle-02.svg';
import type { RootStackParamList } from '@/navigation/types';
import { ClientEditSheet, type ClientField } from './ClientEditSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientDetail'>;
type Editing = 'identity' | 'comment' | null;

/** Client detail shows the newest jobs; the rest are one tap away (S2a). */
const LATEST_JOBS = 3;

/**
 * S2. The client's phone with Call and WhatsApp, their preferences, their sets and their
 * latest jobs. Add job and New measurement sit at the bottom.
 */
export default function ClientDetailScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const [client, setClient] = useState<Client | null>(null);
  const [sets, setSets] = useState<MeasurementSetWithItemsCount[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [editError, setEditError] = useState<string | undefined>();

  const load = useCallback(async () => {
    const [c, s, j] = await Promise.all([
      getClient(database, clientId),
      setsForClient(database, clientId),
      jobRowsForClient(database, clientId),
    ]);
    setClient(c);
    setSets(s);
    setJobs(j);
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openEdit = (what: Editing) => {
    setEditError(undefined);
    setEditing(what);
  };

  const save = async (values: Partial<Record<ClientField['key'], string>>) => {
    try {
      await updateClient(database, clientId, values);
      setEditing(null);
      load();
    } catch (e) {
      if (e instanceof DuplicateClientNameError) setEditError(`There's already a client called ${e.clientName}.`);
      else setEditError(e instanceof Error ? e.message : String(e));
    }
  };

  // Client-first: the set is created only on save (createSetWithMeasurements), so backing
  // out of the hero leaves no empty set behind.
  const newMeasurement = useCallback(async () => {
    const templateId = await getDefaultTemplateId(database);
    navigation.navigate('MeasurementEntry', { templateId, clientId });
  }, [clientId, navigation]);

  // Until the New job screen arrives (plan commit 6), a job starts on Record payment.
  const addJob = () => navigation.navigate('RecordPayment', { clientId });

  if (!client) return <View style={styles.screen} />;

  const phone = client.phone?.trim() ?? '';
  const chat = whatsappLink(phone);
  const owed = totalOwedMinor(jobs);
  const now = nowMs();
  const latest = jobs.slice(0, LATEST_JOBS);

  return (
    <View style={styles.screen}>
      <ScreenHeader title={client.name || 'Unnamed'} />
      <ScrollView contentContainerStyle={styles.content}>
        {phone ? (
          <View style={styles.phoneRow}>
            <Text style={styles.phone} numberOfLines={1} selectable>
              {formatPhone(phone)}
            </Text>
            <Button size="small" label="Call" Icon={PhoneIcon} onPress={() => Linking.openURL(`tel:${phone}`)} />
            {chat ? (
              <Button size="small" label="WhatsApp" Icon={ChatIcon} onPress={() => Linking.openURL(chat)} />
            ) : null}
          </View>
        ) : null}

        <SectionLabel title="Preferences" />
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          onPress={() => openEdit('comment')}
          accessibilityRole="button"
          accessibilityLabel={client.comment ? `Preferences: ${client.comment}. Edit` : 'Add preferences'}
        >
          <Text style={[styles.cardText, !client.comment && styles.placeholder]}>
            {client.comment || 'Add general preferences: fit, fabric, anything.'}
          </Text>
          <EditIcon width={18} height={18} color={colors.muted} style={styles.cardIcon} />
        </Pressable>
        <TextAction
          label={phone ? 'Edit name or phone' : 'Edit name or add phone'}
          onPress={() => openEdit('identity')}
        />

        <SectionLabel title="Measurement sets" aside={String(sets.length)} />
        {sets.length === 0 ? (
          <Text style={styles.empty}>No sets yet.</Text>
        ) : (
          sets.map(({ set, itemsCount, totalCount }, i) => (
            <ClientDetailSetRow
              key={set.id}
              set={set}
              itemsCount={itemsCount}
              totalCount={totalCount}
              last={i === sets.length - 1}
              onPress={() => navigation.navigate('SetDetail', { setId: set.id })}
            />
          ))
        )}

        <SectionLabel
          title="Jobs"
          aside={owed > 0 ? `${formatMoney(owed, jobs[0].currency)} owed` : undefined}
          asideIsNumber
        />
        {jobs.length === 0 ? (
          <Text style={styles.empty}>No jobs yet.</Text>
        ) : (
          latest.map((row, i) => (
            <ClientDetailJobRow
              key={row.jobId}
              row={row}
              now={now}
              last={i === latest.length - 1}
              onPress={() => navigation.navigate('JobDetail', { jobId: row.jobId })}
            />
          ))
        )}
        {jobs.length > LATEST_JOBS ? (
          <TextAction
            label={`View all ${jobs.length} jobs`}
            onPress={() => navigation.navigate('ClientJobs', { clientId })}
          />
        ) : null}
      </ScrollView>

      <BottomBar>
        <Button label="Add job" onPress={addJob} />
        <Button kind="primary" label="New measurement" onPress={newMeasurement} />
      </BottomBar>

      {editing === 'identity' ? (
        <ClientEditSheet
          title="Edit client"
          fields={[
            { key: 'name', label: 'Name', value: client.name, placeholder: 'Name', required: true },
            { key: 'phone', label: 'Phone', value: client.phone ?? '', placeholder: 'Phone number' },
          ]}
          error={editError}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}
      {editing === 'comment' ? (
        <ClientEditSheet
          title="Preferences"
          fields={[
            {
              key: 'comment',
              label: 'Preferences',
              value: client.comment ?? '',
              placeholder: 'e.g. prefers a relaxed fit, no tight collars',
            },
          ]}
          error={editError}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  phone: { ...valueText, flex: 1, fontSize: fontSizes.base, color: colors.text },
  card: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: space.md,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.6 },
  cardText: { flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
  placeholder: { color: colors.muted },
  cardIcon: { marginTop: 2 },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, paddingVertical: space.sm },
});
