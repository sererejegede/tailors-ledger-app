import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { database } from '@/db';
import type AppSettings from '@/db/models/AppSettings';
import type Template from '@/db/models/Template';
import { getSettings, updateSettings } from '@/repositories/settings';
import { listTemplates, setDefaultTemplate } from '@/repositories/templates';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * Local-only settings (data-model §9): default template, soft range warnings, fraction
 * granularity. App lock / voice / account are deferred (inert) for v1.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  const load = useCallback(async () => {
    setSettings(await getSettings(database));
    setTemplates(await listTemplates(database));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const patch = useCallback(
    async (p: Parameters<typeof updateSettings>[1]) => {
      await updateSettings(database, p);
      load();
    },
    [load],
  );

  const chooseDefault = useCallback(
    async (templateId: string) => {
      await setDefaultTemplate(database, templateId);
      await patch({ defaultTemplateId: templateId });
    },
    [patch],
  );

  if (!settings) return <View style={styles.screen} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}>
      <Text style={styles.h1}>Settings</Text>

      {/* Default template */}
      <Text style={styles.section}>Default template</Text>
      <Text style={styles.hint}>New measurements seed from this.</Text>
      <View style={styles.card}>
        {templates.map((t, i) => {
          const selected = settings.defaultTemplateId === t.id;
          return (
            <Pressable
              key={t.id}
              style={[styles.optionRow, i === templates.length - 1 && styles.optionRowLast]}
              onPress={() => chooseDefault(t.id)}
            >
              <Text style={styles.optionText}>{t.name}</Text>
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Fraction steps */}
      <Text style={styles.section}>Fraction steps</Text>
      <View style={styles.segment}>
        {(['quarters', 'eighths'] as const).map((g) => {
          const on = settings.fractionGranularity === g;
          return (
            <Pressable
              key={g}
              style={[styles.segItem, on && styles.segItemOn]}
              onPress={() => patch({ fractionGranularity: g })}
            >
              <Text style={[styles.segText, on && styles.segTextOn]}>
                {g === 'quarters' ? '¼ ½ ¾' : '⅛ steps'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Range warnings */}
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Range warnings</Text>
          <Text style={styles.hint}>Flag values wildly outside a template’s expected range.</Text>
        </View>
        <Switch
          value={settings.rangeWarningsEnabled}
          onValueChange={(v) => patch({ rangeWarningsEnabled: v })}
          trackColor={{ true: colors.accent, false: colors.line2 }}
          thumbColor="#fff"
        />
      </View>

      <Text style={styles.footer}>Units: inches. Voice, app lock, and accounts arrive later.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },
  h1: { fontFamily: fonts.title, fontSize: 28, color: colors.text, marginBottom: space.sm },
  section: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, marginTop: space.md },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    marginTop: space.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  optionRowLast: { borderBottomWidth: 0 },
  optionText: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  segment: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
  },
  segItem: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.default,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  segItemOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  segText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  segTextOn: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
  },
  toggleTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  footer: { fontFamily: fonts.body, fontSize: 13, color: colors.faint, marginTop: space.xl },
});
