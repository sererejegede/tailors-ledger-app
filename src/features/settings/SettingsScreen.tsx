import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { database } from '@/db';
import type AppSettings from '@/db/models/AppSettings';
import type Template from '@/db/models/Template';
import { getSettings, updateSettings, type SettingsPatch } from '@/repositories/settings';
import { listTemplates } from '@/repositories/templates';
import { countOrphans, purgeOrphans } from '@/repositories/maintenance';
import { Alert } from '@/lib/alert';
import { canUseAppLock } from '@/lib/appLock';
import {
  FRACTION_STEPS,
  fractionLabel,
  paymentSummary,
  shopSummary,
  templatesSummary,
} from '@/lib/settingsSummary';
import { colors, space } from '@/theme/tokens';
import { AppLogo } from '@/components/AppLogo';
import { ItemPickerSheet } from '@/components/templates';
import { LinkRow, SectionLabel, SwitchRow, TabTitle } from '@/components/ui';
import { BackupCard } from './BackupCard';

/**
 * S11. The backup card, then short groups: Shop (profile, payment details), Measuring
 * (templates, fraction steps, range warnings) and App (lock). Shop profile, Payment
 * details and Templates open their own screens.
 */
export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [orphanCount, setOrphanCount] = useState(0);
  const [pickingFraction, setPickingFraction] = useState(false);

  const load = useCallback(async () => {
    setSettings(await getSettings(database));
    setTemplates(await listTemplates(database));
    setOrphanCount((await countOrphans(database)).total);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const patch = useCallback(
    async (p: SettingsPatch) => {
      await updateSettings(database, p);
      load();
    },
    [load],
  );

  const toggleAppLock = useCallback(
    async (enabled: boolean) => {
      if (enabled && !(await canUseAppLock())) {
        Alert.alert('App lock unavailable', 'Set up a screen lock (PIN, pattern, or biometrics) on your phone first.');
        return;
      }
      await patch({ appLockEnabled: enabled });
    },
    [patch],
  );

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

  return (
    <View style={styles.screen}>
      <TabTitle title="Settings" />
      {settings ? (
        <ScrollView contentContainerStyle={styles.content}>
          <BackupCard />

          <SectionLabel title="Shop" />
          <LinkRow
            title="Shop profile"
            value={shopSummary(settings.shopName)}
            onPress={() => navigation.navigate('ShopProfile')}
          />
          <LinkRow
            title="Payment details"
            value={paymentSummary(settings.bankName, settings.bankAccountNumber)}
            onPress={() => navigation.navigate('PaymentDetails')}
            last
          />

          <SectionLabel title="Measuring" />
          <LinkRow
            title="Templates"
            value={templatesSummary(templates)}
            onPress={() => navigation.navigate('Templates')}
          />
          <LinkRow
            title="Fraction steps"
            value={fractionLabel(settings.fractionGranularity)}
            onPress={() => setPickingFraction(true)}
          />
          <SwitchRow
            title="Warn when a value looks off"
            value={settings.rangeWarningsEnabled}
            onChange={(on) => patch({ rangeWarningsEnabled: on })}
            last
          />

          <SectionLabel title="App" />
          <SwitchRow
            title="Lock the app"
            value={settings.appLockEnabled}
            onChange={toggleAppLock}
            last={orphanCount === 0}
          />
          {orphanCount > 0 ? (
            <LinkRow title="Clean up un-syncable data" value={`${orphanCount} found`} onPress={repairData} last />
          ) : null}

          <AppLogo />
        </ScrollView>
      ) : null}

      <ItemPickerSheet
        visible={pickingFraction}
        title="Fraction steps"
        options={FRACTION_STEPS.map((f) => ({ id: f.id, name: `${f.name} inch` }))}
        currentId={settings?.fractionGranularity}
        onSelect={(id) => {
          setPickingFraction(false);
          patch({ fractionGranularity: id });
        }}
        onClose={() => setPickingFraction(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingTop: space.xs },
});
