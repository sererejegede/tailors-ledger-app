import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { database, Tables } from '@/db';
import { ensureSeeded } from '@/db/seed';

/**
 * TEMPORARY on-device smoke screen (Phase 1 verification). Boots the native
 * WatermelonDB store, runs the idempotent seed, and shows row counts so a device
 * build immediately proves the DB stack works. This is replaced by the real
 * navigation + screens in Phase 3.
 */
type Counts = { templates: number; templateItems: number; settings: number; seeded: boolean };

export default function App() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const seeded = await ensureSeeded(database);
        const templates = await database.get(Tables.templates).query().fetchCount();
        const templateItems = await database.get(Tables.templateItems).query().fetchCount();
        const settings = await database.get(Tables.appSettings).query().fetchCount();
        setCounts({ templates, templateItems, settings, seeded });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Tailor's Ledger — DB smoke check</Text>
      {error ? (
        <ScrollView style={styles.errorBox}>
          <Text style={styles.errorText}>DB failed to boot:{'\n'}{error}</Text>
        </ScrollView>
      ) : !counts ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.card}>
          <Text style={styles.ok}>✓ WatermelonDB booted</Text>
          <Text style={styles.row}>Seeded this launch: {counts.seeded ? 'yes' : 'no (already seeded)'}</Text>
          <Text style={styles.row}>Templates: {counts.templates}</Text>
          <Text style={styles.row}>Template items: {counts.templateItems}</Text>
          <Text style={styles.row}>Settings rows: {counts.settings}</Text>
          <Text style={styles.hint}>Expected: 2 templates, 26 items, 1 settings row.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F6', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '600', color: '#444748', marginBottom: 20 },
  card: { gap: 8, alignItems: 'flex-start' },
  ok: { fontSize: 16, fontWeight: '700', color: '#810B38', marginBottom: 6 },
  row: { fontSize: 15, color: '#444748' },
  hint: { fontSize: 12, color: '#8C887E', marginTop: 10 },
  errorBox: { maxHeight: 300 },
  errorText: { color: '#a23b2e', fontSize: 13 },
});
