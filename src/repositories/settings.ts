import { Database } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import AppSettings from '@/db/models/AppSettings';

/**
 * App-settings repository. There is a single local row (created by the seed). Most of
 * it is device-local and never syncs (contract §11); the sync cursor / last-sync time
 * also live here (Phase 4).
 */

export type SettingsPatch = Partial<{
  units: string;
  fractionGranularity: string;
  defaultTemplateId: string;
  shopName: string;
  logoUri: string;
  appLockEnabled: boolean;
  textSize: string;
  highContrast: boolean;
  rangeWarningsEnabled: boolean;
  lastSyncedAt: number;
  syncCursor: string;
}>;

/** The single settings row, or null if the DB hasn't been seeded yet. */
export async function getSettings(database: Database): Promise<AppSettings | null> {
  const rows = await database.get<AppSettings>(Tables.appSettings).query().fetch();
  return rows[0] ?? null;
}

export async function updateSettings(
  database: Database,
  patch: SettingsPatch,
): Promise<AppSettings> {
  const settings = await getSettings(database);
  if (!settings) throw new Error('app_settings row missing — seed the database first');
  await database.write(async () => {
    await settings.update((s) => {
      if (patch.units !== undefined) s.units = patch.units;
      if (patch.fractionGranularity !== undefined) s.fractionGranularity = patch.fractionGranularity;
      if (patch.defaultTemplateId !== undefined) s.defaultTemplateId = patch.defaultTemplateId;
      if (patch.shopName !== undefined) s.shopName = patch.shopName;
      if (patch.logoUri !== undefined) s.logoUri = patch.logoUri;
      if (patch.appLockEnabled !== undefined) s.appLockEnabled = patch.appLockEnabled;
      if (patch.textSize !== undefined) s.textSize = patch.textSize;
      if (patch.highContrast !== undefined) s.highContrast = patch.highContrast;
      if (patch.rangeWarningsEnabled !== undefined) s.rangeWarningsEnabled = patch.rangeWarningsEnabled;
      if (patch.lastSyncedAt !== undefined) s.lastSyncedAt = patch.lastSyncedAt;
      if (patch.syncCursor !== undefined) s.syncCursor = patch.syncCursor;
    });
  });
  return settings;
}
