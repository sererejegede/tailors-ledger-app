import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
import { searchClients, createClient, DuplicateClientNameError } from '@/repositories/clients';
import { createDraftSet, createSetFromTemplate } from '@/repositories/sets';
import { getSettings } from '@/repositories/settings';
import { listTemplates } from '@/repositories/templates';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { PromptModal } from '@/components/PromptModal';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Clients home (search-first). Minimal for 3a: it exists to reach the hero —
 * New measurement starts a measure-first draft, tapping a client starts a set for them,
 * Add client creates a name-only client. Full Client detail / polish lands in 3b.
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
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | undefined>();

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

  const openEntry = (setId: string) => navigation.navigate('MeasurementEntry', { setId });

  const newMeasurement = async () => {
    const templateId = await defaultTemplateId();
    const set = await createDraftSet(database, { templateId });
    openEntry(set.id);
  };

  const measureClient = async (client: Client) => {
    const templateId = await defaultTemplateId();
    const set = await createSetFromTemplate(database, { clientId: client.id, templateId });
    openEntry(set.id);
  };

  const addClient = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setAddOpen(false);
      return;
    }
    try {
      await createClient(database, { name: trimmed });
      setAddOpen(false);
      setAddError(undefined);
      reload(term);
    } catch (e) {
      if (e instanceof DuplicateClientNameError) setAddError(e.message);
      else throw e;
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
      <Text style={styles.h1}>Clients</Text>

      <TextInput
        style={styles.search}
        placeholder="Search name or phone"
        placeholderTextColor={colors.faint}
        value={term}
        onChangeText={onSearch}
        autoCorrect={false}
      />

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.primary]} onPress={newMeasurement}>
          <Text style={styles.primaryText}>＋ New measurement</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.secondary]}
          onPress={() => {
            setAddError(undefined);
            setAddOpen(true);
          }}
        >
          <Text style={styles.secondaryText}>Add client</Text>
        </Pressable>
      </View>

      {clients == null ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(c) => c.id}
          contentContainerStyle={clients.length === 0 && styles.emptyWrap}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {term ? 'No matching clients.' : 'No clients yet — start a measurement or add one.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => measureClient(item)}>
              <Text style={styles.rowName}>{item.name || 'Unnamed'}</Text>
              {item.phone ? <Text style={styles.rowPhone}>{item.phone}</Text> : null}
            </Pressable>
          )}
        />
      )}

      <PromptModal
        visible={addOpen}
        title="Add client"
        message="A name is all you need — phone and notes can come later."
        placeholder="Client name"
        submitLabel="Add"
        error={addError}
        onCancel={() => setAddOpen(false)}
        onSubmit={addClient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  h1: { fontFamily: fonts.title, fontSize: 28, color: colors.text, marginBottom: space.md },
  search: {
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  actions: { flexDirection: 'row', gap: space.sm, marginVertical: space.md },
  btn: { flex: 1, paddingVertical: space.md, borderRadius: radius.md, alignItems: 'center' },
  primary: { backgroundColor: colors.accent },
  primaryText: { fontFamily: fonts.bold, color: '#fff', fontSize: 15 },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line2 },
  secondaryText: { fontFamily: fonts.semibold, color: colors.text, fontSize: 15 },
  row: {
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowName: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  rowPhone: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  emptyWrap: { paddingTop: space.xl, alignItems: 'center' },
  empty: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: 'center' },
});
