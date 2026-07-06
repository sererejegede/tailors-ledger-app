import { Database, Model } from '@nozbe/watermelondb';
import { sanitizedRaw, type DirtyRaw, type RawRecord } from '@nozbe/watermelondb/RawRecord';
import { nowMs } from '@/lib/time';
import { syncWarn } from './logger';
import {
  SYNC_TABLES,
  PARENT_EDGES,
  type ChangeEnvelope,
  type EntityChanges,
  type SyncTable,
  type WireRow,
} from './types';

/**
 * Model ⇆ wire mapping for the hand-rolled sync loop.
 *
 * Two halves:
 *  - **collect** — gather locally-dirty rows (WatermelonDB `_status`/`_changed`, never a
 *    `sync_status` column — data-model §6) into a change envelope to push.
 *  - **apply** — write server-canonical rows back as `synced` (not dirty), so adopted
 *    `applied` rows and pulled changes don't get re-pushed.
 *
 * Field filtering (contract §11): device-local columns never cross the wire. Because our
 * column names already equal the contract's snake_case field names, the per-table
 * allowlist below doubles as the wire shape. Soft deletes (our `deleted_at` tombstones)
 * map to **bare ids** in `deleted[]` (§3) — we do NOT send `deleted_at` on the wire.
 */

/** Columns that cross the wire per table. Omissions are device-local (§11):
 * `clients.photo_local_uri`, `images.local_uri`, `images.upload_status`. */
const WIRE_COLUMNS: Record<SyncTable, string[]> = {
  clients: ['name', 'phone', 'comment', 'photo_remote_url', 'created_at', 'updated_at', 'deleted_at'],
  templates: ['name', 'is_default', 'created_at', 'updated_at', 'deleted_at'],
  template_items: [
    'template_id', 'key', 'position', 'unit', 'min_range', 'max_range',
    'created_at', 'updated_at', 'deleted_at',
  ],
  measurement_sets: [
    'client_id', 'template_id', 'template_name_snapshot', 'label', 'note',
    'created_at', 'updated_at', 'deleted_at',
  ],
  measurement_items: [
    'set_id', 'key', 'position', 'unit', 'current_value', 'current_value_at',
    'created_at', 'updated_at', 'deleted_at',
  ],
  measurement_values: ['item_id', 'value', 'recorded_at', 'source', 'created_at'],
  images: ['set_id', 'kind', 'remote_url', 'width', 'height', 'created_at', 'updated_at', 'deleted_at'],
};

/** measurement_values is append-only — it never carries `updated`/`deleted` (§3, §7). */
const APPEND_ONLY: SyncTable = 'measurement_values';

function emptyEntity(): EntityChanges {
  return { created: [], updated: [], deleted: [] };
}

function emptyEnvelope(): ChangeEnvelope {
  return {
    clients: emptyEntity(),
    templates: emptyEntity(),
    template_items: emptyEntity(),
    measurement_sets: emptyEntity(),
    measurement_items: emptyEntity(),
    measurement_values: { created: [] },
    images: emptyEntity(),
  };
}

/**
 * Coerce a (possibly partial) server envelope into a full one — every entity present with
 * `created`/`updated`/`deleted` arrays. Servers legitimately omit entity keys they have no
 * changes for (contract §3 shows the full shape, but a real response trims it); normalizing
 * on receipt means `applyServerChanges` and logging never trip over a missing key.
 */
export function normalizeEnvelope(partial: Partial<ChangeEnvelope> | undefined): ChangeEnvelope {
  const base = emptyEnvelope();
  if (!partial) return base;
  for (const table of SYNC_TABLES) {
    const e = partial[table] as Partial<EntityChanges> | undefined;
    if (!e) continue;
    if (table === APPEND_ONLY) {
      base.measurement_values.created = e.created ?? [];
    } else {
      const target = base[table] as EntityChanges;
      target.created = e.created ?? [];
      target.updated = e.updated ?? [];
      target.deleted = e.deleted ?? [];
    }
  }
  return base;
}

/** Project a record's raw onto its wire columns (+ `id`), dropping device-local fields. */
function toWireRow(table: SyncTable, record: Model): WireRow {
  const raw = record._raw as Record<string, unknown>;
  const row: WireRow = { id: record.id };
  for (const col of WIRE_COLUMNS[table]) row[col] = raw[col] ?? null;
  return row;
}

// ── Collect: local dirty rows → push envelope ───────────────────────────────────────

export type LocalChanges = {
  envelope: ChangeEnvelope;
  /** Tombstone rows pushed as bare ids, kept so the client can flip them `synced` on ack. */
  deletedRecords: { table: SyncTable; record: Model }[];
  count: number;
};

/**
 * Collect every locally-changed row across the syncable tables. A row is dirty when its
 * WatermelonDB `syncStatus !== 'synced'`. We fetch all rows per table and filter in JS —
 * fine at a tailor's data volume, and it sidesteps querying the engine's reserved
 * `_status` column. Soft-deleted rows (`deletedAt` set) become bare ids in `deleted[]`;
 * everything else lands in `created`/`updated` by status.
 */
export async function collectLocalChanges(database: Database): Promise<LocalChanges> {
  const envelope = emptyEnvelope();
  const deletedRecords: LocalChanges['deletedRecords'] = [];
  let count = 0;

  for (const table of SYNC_TABLES) {
    const all = await database.get(table).query().fetch();
    for (const record of all) {
      if (record.syncStatus === 'synced') continue;
      count += 1;

      const deletedAt = (record._raw as { deleted_at?: number | null }).deleted_at;
      if (table !== APPEND_ONLY && deletedAt != null) {
        (envelope[table] as EntityChanges).deleted.push(record.id);
        deletedRecords.push({ table, record });
        continue;
      }

      const wireRow = toWireRow(table, record);
      if (table === APPEND_ONLY) {
        envelope.measurement_values.created.push(wireRow);
      } else if (record.syncStatus === 'created') {
        (envelope[table] as EntityChanges).created.push(wireRow);
      } else {
        (envelope[table] as EntityChanges).updated.push(wireRow);
      }
    }
  }

  // Pull every dirty child's parent chain into the push, even parents already synced
  // locally — so the server can't hit an FK violation applying a child before its parent.
  count += await closeOverParents(database, envelope);

  return { envelope, deletedRecords, count };
}

/**
 * Add any missing parents of the rows already in `envelope` until the push is referentially
 * closed (fixpoint, so transitive chains like value → item → set → client are covered). A
 * parent that's currently `synced` locally is re-sent as `updated` — idempotent under LWW
 * (§9), and the reason the server reliably has the parent before the child. A child whose
 * parent is missing or soft-deleted locally is a real inconsistency: we warn and skip
 * rather than emit an off-contract row. Returns how many parent rows were added.
 */
async function closeOverParents(database: Database, envelope: ChangeEnvelope): Promise<number> {
  const present: Record<string, Set<string>> = {};
  for (const table of SYNC_TABLES) {
    const e = envelope[table] as Partial<EntityChanges>;
    present[table] = new Set<string>([
      ...(e.created ?? []).map((r) => r.id),
      ...(e.updated ?? []).map((r) => r.id),
      ...(e.deleted ?? []),
    ]);
  }

  let added = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const childTable of SYNC_TABLES) {
      const edges = PARENT_EDGES[childTable];
      if (!edges) continue;
      const childEntity = envelope[childTable] as Partial<EntityChanges>;
      const childRows = [...(childEntity.created ?? []), ...(childEntity.updated ?? [])];

      for (const edge of edges) {
        for (const childRow of childRows) {
          const parentId = childRow[edge.fk];
          if (typeof parentId !== 'string' || !parentId) continue; // null/optional FK
          if (present[edge.table].has(parentId)) continue;

          present[edge.table].add(parentId); // mark seen up-front (skip re-fetch/re-warn)
          let parent: Model;
          try {
            parent = await database.get(edge.table).find(parentId);
          } catch {
            syncWarn(`push — dirty ${childTable} references missing ${edge.table}: ${parentId}`);
            continue;
          }
          if ((parent._raw as { deleted_at?: number | null }).deleted_at != null) {
            syncWarn(`push — dirty ${childTable} references deleted ${edge.table}: ${parentId}`);
            continue;
          }
          (envelope[edge.table] as EntityChanges).updated.push(toWireRow(edge.table, parent));
          added += 1;
          changed = true; // its own parents get picked up next pass
        }
      }
    }
  }
  return added;
}

// ── Apply: server-canonical rows → local store as `synced` ───────────────────────────

async function findOrNull(database: Database, table: SyncTable, id: string): Promise<Model | null> {
  try {
    return await database.get(table).find(id);
  } catch {
    return null;
  }
}

/**
 * Build a sanitized, `synced` raw for a server row. For an existing record we start from
 * its current raw so device-local columns (e.g. `photo_local_uri`, `images.local_uri`)
 * are preserved; wire columns overwrite. For a brand-new inbound row those locals default
 * to empty — except images, where we seed sensible values so a pulled photo is usable
 * (contract §8 step 4: it arrives with `remote_url`, no local file yet).
 */
function syncedRawFor(
  table: SyncTable,
  wireRow: WireRow,
  existing: Model | null,
  schema: Parameters<typeof sanitizedRaw>[1],
): RawRecord {
  const base: DirtyRaw = existing ? { ...(existing._raw as DirtyRaw) } : { id: wireRow.id };
  for (const col of WIRE_COLUMNS[table]) base[col] = wireRow[col] ?? null;

  if (!existing && table === 'images') {
    base.upload_status = 'uploaded';
    base.local_uri = (wireRow.remote_url as string | null) ?? '';
  }

  base.id = wireRow.id;
  base._status = 'synced';
  base._changed = '';
  return sanitizedRaw(base, schema);
}

/**
 * Apply a server change envelope (a pull's `changes`, or a push's `applied`) to the local
 * store, writing every row as `synced`. Upserts handle `created`+`updated` uniformly
 * (LWW already resolved server-side; the client adopts the canonical row wholesale).
 * `deleted` ids become local `deleted_at` tombstones (server-stamped time unavailable on
 * the wire, so we stamp receive-time), also marked `synced`. Append-only values only ever
 * upsert. Runs in one write/batch.
 */
export async function applyServerChanges(
  database: Database,
  envelope: ChangeEnvelope,
  now: number = nowMs(),
): Promise<{ upserted: number; deleted: number }> {
  let upserted = 0;
  let deleted = 0;

  await database.write(async () => {
    const ops: Model[] = [];

    for (const table of SYNC_TABLES) {
      const changes = envelope[table] as Partial<EntityChanges> | undefined;
      if (!changes) continue;
      const collection = database.get(table);
      const upserts = [...(changes.created ?? []), ...(changes.updated ?? [])];

      for (const wireRow of upserts) {
        const existing = await findOrNull(database, table, wireRow.id);
        const raw = syncedRawFor(table, wireRow, existing, collection.schema);
        if (existing) {
          ops.push(existing.prepareUpdate(() => { (existing as Model)._raw = raw; }));
        } else {
          ops.push(collection.prepareCreateFromDirtyRaw(raw));
        }
        upserted += 1;
      }

      for (const id of changes.deleted ?? []) {
        const existing = await findOrNull(database, table, id);
        if (!existing) continue;
        ops.push(
          existing.prepareUpdate(() => {
            const raw = existing._raw as { deleted_at?: number | null; _status: string; _changed: string };
            if (raw.deleted_at == null) raw.deleted_at = now;
            raw._status = 'synced';
            raw._changed = '';
          }),
        );
        deleted += 1;
      }
    }

    if (ops.length) await database.batch(ops);
  });

  return { upserted, deleted };
}

/**
 * Flip pushed tombstones to `synced` after the server acks the push, so they stop being
 * re-collected. (The rows stay soft-deleted; server-side purge of tombstones is a later
 * concern — we never hard-delete on device.)
 */
export async function markDeletesSynced(
  database: Database,
  deletedRecords: LocalChanges['deletedRecords'],
): Promise<void> {
  if (!deletedRecords.length) return;
  await database.write(async () => {
    const ops = deletedRecords.map(({ record }) =>
      record.prepareUpdate(() => {
        const raw = record._raw as { _status: string; _changed: string };
        raw._status = 'synced';
        raw._changed = '';
      }),
    );
    await database.batch(ops);
  });
}

export const _internal = { WIRE_COLUMNS, toWireRow, emptyEnvelope };
