import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { database } from '@/db';
import type Client from '@/db/models/Client';
import { createClient, DuplicateClientNameError, searchClients } from '@/repositories/clients';
import { allJobRows } from '@/repositories/jobBoard';
import { getSettings } from '@/repositories/settings';
import { listTemplates } from '@/repositories/templates';
import { owedByClient, weekSummary, type JobRow } from '@/lib/jobBoard';
import { DEFAULT_CURRENCY, formatMoney } from '@/lib/money';
import { formatWeekday, nowMs } from '@/lib/time';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { ClientRow } from '@/components/ClientRow';
import { InstallPrompt } from '@/components/InstallPrompt';
import { PwaUpdatePrompt } from '@/components/PwaUpdatePrompt';
import { FadeInView, NameSheet, PlusMenu, SectionLabel, TabTitle } from '@/components/ui';
import SearchIcon from '@/assets/icons/search-sm.svg';
import RulerIcon from '@/assets/icons/ruler.svg';
import UserPlusIcon from '@/assets/icons/user-plus-01.svg';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Clients home (S1), search-first. "This week" tiles show the jobs due and what's still
 * owed; each row shows what that client owes. The + button (S1a) starts a measure-first
 * session or adds a client by name.
 */
async function defaultTemplateId(): Promise<string> {
  const settings = await getSettings(database);
  if (settings?.defaultTemplateId) return settings.defaultTemplateId;
  const templates = await listTemplates(database);
  const fallback = templates.find((t) => t.isDefault) ?? templates[0];
  if (!fallback) throw new Error('No template available — seed the database.');
  return fallback.id;
}

export default function ClientsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [term, setTerm] = useState('');
  const [clients, setClients] = useState<Client[] | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | undefined>();

  const reload = useCallback(async (q: string) => {
    const [found, rows] = await Promise.all([searchClients(database, q), allJobRows(database)]);
    setClients(found);
    setJobs(rows);
  }, []);

  // Reload whenever the tab regains focus (e.g. returning from a saved measurement).
  useFocusEffect(
    useCallback(() => {
      reload(term);
    }, [reload, term]),
  );

  const onSearch = (q: string) => {
    setTerm(q);
    reload(q);
  };

  const owed = useMemo(() => owedByClient(jobs), [jobs]);
  const week = useMemo(() => weekSummary(jobs, nowMs()), [jobs]);
  const currency = jobs[0]?.currency ?? DEFAULT_CURRENCY;

  // Measure-first: jump straight into the hero with just the template. No client/set rows
  // are written until the tailor saves and names the draft (createSetWithMeasurements).
  const newMeasurement = async () => {
    const templateId = await defaultTemplateId();
    navigation.navigate('MeasurementEntry', { templateId });
  };

  const openAdd = () => {
    setAddError(undefined);
    setAdding(true);
  };

  // A client needs nothing but a name (spec §3); the rest is filled in on Client detail.
  const addClient = async (name: string) => {
    try {
      const client = await createClient(database, { name });
      setAdding(false);
      navigation.navigate('ClientDetail', { clientId: client.id });
    } catch (e) {
      if (e instanceof DuplicateClientNameError) setAddError(`There's already a client called ${e.clientName}.`);
      else throw e;
    }
  };

  const searching = term.trim().length > 0;

  const header = (
    <View>
      <InstallPrompt />
      <PwaUpdatePrompt />
      <View style={styles.search}>
        <SearchIcon width={20} height={20} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name or phone"
          placeholderTextColor={colors.muted}
          value={term}
          onChangeText={onSearch}
          autoCorrect={false}
          accessibilityLabel="Search name or phone"
        />
      </View>

      {searching ? null : (
        <>
          <SectionLabel title="This week" />
          <View style={styles.tiles}>
            <Pressable
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              onPress={() => navigation.navigate('Tabs', { screen: 'Jobs', params: { filter: 'all' } })}
              accessibilityRole="button"
              accessibilityLabel={`${week.dueCount} jobs due this week`}
            >
              <Text style={styles.tileLabel}>Due</Text>
              <Text style={styles.tileValue}>
                {week.dueCount} {week.dueCount === 1 ? 'job' : 'jobs'}
              </Text>
              <Text style={styles.tileLabel}>
                {week.nextDue != null ? `Next: ${formatWeekday(week.nextDue)}` : week.dueCount ? 'Overdue' : 'Nothing this week'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              onPress={() => navigation.navigate('Tabs', { screen: 'Jobs', params: { filter: 'owed' } })}
              accessibilityRole="button"
              accessibilityLabel={`${formatMoney(week.owedMinor, currency)} still owed`}
            >
              <Text style={styles.tileLabel}>Still owed</Text>
              <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(week.owedMinor, currency)}
              </Text>
              <Text style={styles.tileLabel}>
                {week.owedClients ? `across ${week.owedClients} ${week.owedClients === 1 ? 'client' : 'clients'}` : 'All paid up'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <SectionLabel title={`${searching ? 'Matches' : 'All clients'} · ${clients?.length ?? 0}`} />
    </View>
  );

  return (
    <View style={styles.screen}>
      <TabTitle title="Clients" />

      {clients == null ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : (
        <FadeInView>
          <FlatList
            data={clients}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={header}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {searching ? 'No matching clients.' : 'No clients yet. Tap + to add one or start measuring.'}
              </Text>
            }
            renderItem={({ item, index }) => {
              const minor = owed.get(item.id);
              return (
                <ClientRow
                  client={item}
                  owed={minor ? formatMoney(minor, currency) : undefined}
                  last={index === clients.length - 1}
                  onPress={() => navigation.navigate('ClientDetail', { clientId: item.id })}
                />
              );
            }}
          />
        </FadeInView>
      )}

      <PlusMenu
        accessibilityLabel="Add client or new measurement"
        items={[
          { label: 'New measurement', Icon: RulerIcon, onPress: newMeasurement },
          { label: 'Add client', Icon: UserPlusIcon, onPress: openAdd },
        ]}
      />

      {adding ? (
        <NameSheet
          title="Add client"
          placeholder="Name"
          submitLabel="Add client"
          error={addError}
          onClose={() => setAdding(false)}
          onSubmit={addClient}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  tileLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  tileValue: { ...valueText, fontSize: 22, fontWeight: '600', color: colors.text, marginVertical: 2 },
  // Room under the last row for the + button.
  listContent: { paddingHorizontal: space.lg, paddingBottom: 96 },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.muted, textAlign: 'center', paddingTop: space.xl },
});
