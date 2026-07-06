import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { database } from '@/db';
import type AppSettings from '@/db/models/AppSettings';
import type Template from '@/db/models/Template';
import { getSettings, updateSettings } from '@/repositories/settings';
import { listTemplates, setDefaultTemplate } from '@/repositories/templates';
import { countOrphans, purgeOrphans } from '@/repositories/maintenance';
import { resetTips } from '@/lib/seenTips';
import { canUseAppLock } from '@/lib/appLock';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { useFontScale } from '@/theme/textScale';
import { AccountSection } from './AccountSection';
import { SettingsRow } from '@/components/SettingsRow';
import { ItemPickerSheet } from '@/components/templates';
import { Divider } from '@/components/Divider';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { setLarge } = useFontScale();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [orphanCount, setOrphanCount] = useState(0);
  const [activeSetting, setActiveSetting] = useState<(typeof allSettings)[number] | null>(null);


  const load = useCallback(async () => {
    setSettings(await getSettings(database));
    setTemplates(await listTemplates(database));
    setOrphanCount((await countOrphans(database)).total);
  }, []);

  // One-time repair: remove orphaned, never-synced rows (leftovers from old empty drafts /
  // manual cleanup) that reference deleted parents and so can never sync. Confirmed first.
  const repairData = useCallback(() => {
    Alert.alert(
      'Clean up un-syncable data?',
      `Found ${orphanCount} leftover row${orphanCount === 1 ? '' : 's'} that reference deleted ` +
        `clients, sets, or templates and can never sync. Remove them? Your saved measurements ` +
        `are not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const report = await purgeOrphans(database);
            await load();
            Alert.alert('Cleaned up', `Removed ${report.total} un-syncable row${report.total === 1 ? '' : 's'}.`);
          },
        },
      ],
    );
  }, [orphanCount, load]);

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

  const chooseTextSize = useCallback(
    async (size: 'normal' | 'large') => {
      setLarge(size === 'large'); // apply immediately app-wide
      await patch({ textSize: size });
    },
    [patch, setLarge],
  );

  const toggleAppLock = useCallback(
    async (enabled: boolean) => {
      if (enabled && !(await canUseAppLock())) {
        Alert.alert(
          'App lock unavailable',
          'Set up a screen lock (PIN, pattern, or biometrics) on your device first.',
        );
        return;
      }
      await patch({ appLockEnabled: enabled });
    },
    [patch],
  );

  const replayTips = useCallback(async () => {
    await resetTips();
    Alert.alert('How to use', 'Tips will show again the next time you open each screen.');
  }, []);

  const fractionSteps = [
    { id: 'quarters', name: '¼ steps' },
    { id: 'eighths', name: '⅛ steps' },
  ];
  const textSizes = [
    { id: 'normal', name: 'Normal' },
    { id: 'large', name: 'Large' },
  ];

  const allSettings = useMemo(() => {
    return [
      { key: 'default_template', title: 'Default template', options: templates, onSave: chooseDefault, value: settings?.defaultTemplateId },
      { key: 'fraction_granularity', title: 'Fraction steps', options: fractionSteps, onSave: (id: string) => patch({ fractionGranularity: id }), value: settings?.fractionGranularity },
      { key: 'text_size', title: 'Text size', options: textSizes, onSave: (id: string) => chooseTextSize(id as 'normal' | 'large'), value: settings?.textSize },
      { key: 'range_warnings', title: 'Range warnings', options: [], onSave: null, value: settings?.rangeWarningsEnabled },
      { key: 'app_lock', title: 'App lock', options: [], onSave: null, value: settings?.appLockEnabled },
    ]
  }, [templates, patch]);

  const itemPickerVisible = useMemo(() => {
    return activeSetting ? ['default_template', 'fraction_granularity', 'text_size'].includes(activeSetting?.key) : false;
  }, [activeSetting]);

  if (!settings) return <View style={styles.screen} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}>
      <Text style={styles.h1}>Settings</Text>

      <AccountSection />

      <Divider color={colors.bg} />

      {
        allSettings.map((s) => {
          const value = s.value;
          const valueDisplay = (s?.options?.find((o) => o.id === value)?.name || value) ?? "";
          const handlePress = () => {
            if (s.key === "app_lock") {
              toggleAppLock(!value);
            } else if (s.key === "range_warnings") {
              patch({ rangeWarningsEnabled: !value });
            } else {
              setActiveSetting(s);
            }
          }
          return (
            <SettingsRow
              key={s.key}
              title={s.title}
              value={valueDisplay}
              disabled={s.key === "text_size"}
              onPress={handlePress}
            />
          )
        })
      }

      <SettingsRow title="Show tips again" value="" onPress={replayTips} />

      {orphanCount > 0 ? (
        <SettingsRow
          title="Clean up un-syncable data"
          value={`${orphanCount} found`}
          onPress={repairData}
        />
      ) : null}

      <ItemPickerSheet
        visible={itemPickerVisible}
        options={activeSetting?.options ?? []}
        currentId={activeSetting?.value as string}
        onSelect={(id) => {
          activeSetting?.onSave?.(id);
          setActiveSetting(null);
        }}
        onClose={() => setActiveSetting(null)}
        bottomInset={insets.bottom}
      />
    </ScrollView>

    
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {  paddingBottom: space.xl },
  h1: { paddingHorizontal: space.lg, fontFamily: fonts.title, fontSize: 28, color: colors.text, marginBottom: space.sm },
  section: { paddingHorizontal: space.lg,fontFamily: fonts.semibold, fontSize: 15, color: colors.text, marginTop: space.md },
  hint: { paddingHorizontal: space.lg,fontFamily: fonts.body, fontSize: 13, color: colors.muted },
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
});
