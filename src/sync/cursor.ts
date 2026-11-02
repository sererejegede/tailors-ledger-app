import { Database } from '@nozbe/watermelondb';
import { settings as settingsRepo } from '@/repositories';

/**
 * The pull cursor is the contract's opaque `server_seq` string (sync-contract §4),
 * persisted in our own side-channel — `app_settings.sync_cursor` (+ `last_synced_at`) —
 * NOT WatermelonDB's wall-clock `lastPulledAt` (resolved decision, data-model §6). We
 * drive the hand-rolled loop off this value alone.
 */

/** The stored opaque cursor, or `null` for "first sync — send me everything" (§4). An
 * empty string (how `resetCursor` clears it) is normalized to `null`. */
export async function getCursor(database: Database): Promise<string | null> {
  const settings = await settingsRepo.getSettings(database);
  return settings?.syncCursor || null;
}

export async function setCursor(database: Database, cursor: string): Promise<void> {
  await settingsRepo.updateSettings(database, { syncCursor: cursor });
}

/** Drop the cursor back to "first sync" — used on a `409 cursor too old` (§10). */
export async function resetCursor(database: Database): Promise<void> {
  await settingsRepo.updateSettings(database, { syncCursor: '' });
}

export async function setLastSyncedAt(database: Database, when: number): Promise<void> {
  await settingsRepo.updateSettings(database, { lastSyncedAt: when });
}

export async function getLastSyncedAt(database: Database): Promise<number | null> {
  const settings = await settingsRepo.getSettings(database);
  return settings?.lastSyncedAt ?? null;
}

/**
 * The tables this build syncs, remembered after each sync. A build that didn't know a
 * table skipped its rows on pull while its cursor still moved past them, so the first
 * sync after an upgrade that adds a table pulls everything once (`cursor: null`,
 * sync-contract §4). Kept in WatermelonDB's local key-value store, not `app_settings`,
 * so it needs no schema change.
 */
const SYNCED_TABLES_KEY = 'synced_tables';

export async function syncedTablesChanged(database: Database, tables: readonly string[]): Promise<boolean> {
  const stored = await database.localStorage.get<string>(SYNCED_TABLES_KEY);
  return stored !== tables.join(',');
}

export async function rememberSyncedTables(database: Database, tables: readonly string[]): Promise<void> {
  await database.localStorage.set(SYNCED_TABLES_KEY, tables.join(','));
}
