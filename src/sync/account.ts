import { Database, Model } from '@nozbe/watermelondb';
import {
  PARENT_EDGES,
  SYNC_TABLES,
  type ChangeEnvelope,
  type EntityChanges,
  type SyncResult,
  type SyncTable,
} from './types';

/**
 * Which account the device's data belongs to. One local store holds one account's data at a
 * time: a different account signing in re-scopes the store (client.ts). Kept in
 * WatermelonDB's local key-value store, not `app_settings`, so it needs no schema change.
 */
export type SyncAccount = { id: string; email: string | null };

const ACCOUNT_KEY = 'sync_account';

export async function getSyncAccount(database: Database): Promise<SyncAccount | null> {
  const stored = await database.localStorage.get<string>(ACCOUNT_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<SyncAccount>;
    return typeof parsed.id === 'string' ? { id: parsed.id, email: parsed.email ?? null } : null;
  } catch {
    return null;
  }
}

export async function setSyncAccount(database: Database, account: SyncAccount): Promise<void> {
  await database.localStorage.set(ACCOUNT_KEY, JSON.stringify(account));
}

/**
 * Rows that exist only on this device: anything not yet pushed, plus photos whose bytes
 * haven't uploaded. These belong to the account the device holds, so they block a switch to
 * another account until they're backed up.
 */
export async function countUnsynced(database: Database): Promise<number> {
  let count = 0;
  for (const table of SYNC_TABLES) {
    const all = await database.get(table).query().fetch();
    for (const record of all) {
      const raw = record._raw as { deleted_at?: number | null; upload_status?: string };
      if (record.syncStatus !== 'synced') count += 1;
      else if (table === 'images' && raw.deleted_at == null && raw.upload_status !== 'uploaded') count += 1;
    }
  }
  return count;
}

/**
 * Run before signing out, while the account that owns the changes is still signed in: if
 * anything exists only on this device, sync once so it's backed up under this account
 * before the switch. Returns what's still not backed up afterwards (offline, a server
 * error, or rows the server rejects), so the caller can warn before signing out.
 */
export async function backUpBeforeSignOut(
  database: Database,
  sync: () => Promise<SyncResult>,
): Promise<{ unsynced: number; error: string | null }> {
  if ((await countUnsynced(database)) === 0) return { unsynced: 0, error: null };
  const result = await sync();
  const error = !result.ok && 'error' in result ? result.error : null;
  return { unsynced: await countUnsynced(database), error };
}

/** Every id a pull envelope mentions, live or tombstoned, per table. */
export type SeenIds = Map<SyncTable, Set<string>>;

export function recordSeen(seen: SeenIds, changes: ChangeEnvelope): void {
  for (const table of SYNC_TABLES) {
    const e = changes[table] as Partial<EntityChanges>;
    const ids = seen.get(table) ?? new Set<string>();
    for (const row of [...(e.created ?? []), ...(e.updated ?? [])]) ids.add(row.id);
    for (const id of e.deleted ?? []) ids.add(id);
    seen.set(table, ids);
  }
}

/**
 * After a full pull of the signed-in account, remove the synced rows that account doesn't
 * have: they belong to another account (or were purged on the server). Only `synced` rows
 * go: every one of them is already backed up on the server under its own account. Rows not
 * yet pushed are never touched, and nor is any parent they need. The one hard delete outside
 * starter templates (data model §1c). Returns how many rows were removed.
 */
export async function pruneRowsNotInAccount(database: Database, seen: SeenIds): Promise<number> {
  let removed = 0;
  await database.write(async () => {
    const rows = new Map<SyncTable, Model[]>();
    for (const table of SYNC_TABLES) rows.set(table, await database.get(table).query().fetch());

    const keep = parentsOfUnsynced(rows);
    const ops: Model[] = [];
    for (const table of SYNC_TABLES) {
      const ids = seen.get(table) ?? new Set<string>();
      for (const record of rows.get(table)!) {
        if (record.syncStatus !== 'synced' || ids.has(record.id)) continue;
        if (keep.get(table)?.has(record.id)) continue;
        ops.push(record.prepareDestroyPermanently());
        removed += 1;
      }
    }
    if (ops.length) await database.batch(ops);
  });
  return removed;
}

/** Ids of every row an unsynced row hangs off (its parent chain), so a prune can't orphan it. */
function parentsOfUnsynced(rows: Map<SyncTable, Model[]>): Map<SyncTable, Set<string>> {
  const byId = new Map<string, Model>();
  for (const [table, list] of rows) for (const r of list) byId.set(`${table}:${r.id}`, r);

  const keep = new Map<SyncTable, Set<string>>();
  const stack: { table: SyncTable; record: Model }[] = [];
  for (const [table, list] of rows) {
    for (const record of list) if (record.syncStatus !== 'synced') stack.push({ table, record });
  }
  while (stack.length) {
    const { table, record } = stack.pop()!;
    for (const edge of PARENT_EDGES[table] ?? []) {
      const parentId = (record._raw as Record<string, unknown>)[edge.fk];
      if (typeof parentId !== 'string' || !parentId) continue;
      const kept = keep.get(edge.table) ?? new Set<string>();
      if (kept.has(parentId)) continue;
      kept.add(parentId);
      keep.set(edge.table, kept);
      const parent = byId.get(`${edge.table}:${parentId}`);
      if (parent) stack.push({ table: edge.table, record: parent });
    }
  }
  return keep;
}
