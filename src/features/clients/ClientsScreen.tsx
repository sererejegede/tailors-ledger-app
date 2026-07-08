import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { database } from '@/db';
import type Client from '@/db/models/Client';
import { searchClients } from '@/repositories/clients';
import { getSettings } from '@/repositories/settings';
import { listTemplates } from '@/repositories/templates';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { ClientRow } from '@/components/ClientRow';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { InstallPrompt } from '@/components/InstallPrompt';
import { PwaUpdatePrompt } from '@/components/PwaUpdatePrompt';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Clients home (search-first). New measurement (FAB) starts a measure-first session;
 * tapping a client opens their detail. Clients are created by measuring (measure-first
 * save, or the in-hero "add client"), so there's no separate add-client form here.
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
  const insets = useSafeAreaInsets();

  const [term, setTerm] = useState('');
  const [clients, setClients] = useState<Client[] | null>(null);

  const reload = useCallback(async (q: string) => {
    setClients(await searchClients(database, q));
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

  // Measure-first: jump straight into the hero with just the template. No client/set rows
  // are written until the tailor saves and names the draft (createSetWithMeasurements).
  const newMeasurement = async () => {
    const templateId = await defaultTemplateId();
    navigation.navigate('MeasurementEntry', { templateId });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
      <Text style={styles.h1}>Clients</Text>

      <InstallPrompt />
      <PwaUpdatePrompt />

      <TextInput
        style={styles.search}
        placeholder="Search name or phone"
        placeholderTextColor={colors.faint}
        value={term}
        onChangeText={onSearch}
        autoCorrect={false}
      />

      {clients == null ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.listContent, clients.length === 0 && styles.emptyWrap]}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {term ? 'No matching clients.' : 'No clients yet — start a measurement.'}
            </Text>
          }
          renderItem={({ item }) => (
            <ClientRow
              client={item}
              onPress={() => navigation.navigate('ClientDetail', { clientId: item.id })}
            />
          )}
        />
      )}

      <FloatingActionButton
        onPress={newMeasurement}
        accessibilityLabel="New measurement"
        label="New Measurement"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontFamily: fonts.title, fontSize: fontSizes['3xl'], color: colors.text, marginBottom: space.md, paddingHorizontal: space.lg },
  search: {
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.default,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.text,
    backgroundColor: colors.surface,
    marginHorizontal: space.lg,
  },
  listContent: { paddingTop: space.sm, paddingBottom: 96 },
  row: {
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowName: { fontFamily: fonts.semibold, fontSize: fontSizes.lg, color: colors.text },
  rowPhone: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
  emptyWrap: { paddingTop: space.xl, alignItems: 'center' },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.muted, textAlign: 'center' },
});
