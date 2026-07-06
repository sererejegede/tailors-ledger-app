import {
  SYNC_TABLES,
  PARENT_EDGES,
  type ChangeEnvelope,
  type EntityChanges,
  type RejectedRow,
  type SyncTable,
  type WireRow,
} from './types';

/**
 * Lightweight, prefixed console logging for the sync loop. On in dev (`__DEV__`), quiet in
 * tests/prod — errors always print. Keeps the noisy-but-invaluable "what crossed the wire"
 * trace available on a device build without a logging dependency.
 */
const ENABLED = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

/* eslint-disable no-console */
export function syncLog(...args: unknown[]): void {
  if (ENABLED) console.log('[sync]', ...args);
}
export function syncWarn(...args: unknown[]): void {
  if (ENABLED) console.warn('[sync]', ...args);
}
export function syncError(...args: unknown[]): void {
  console.error('[sync]', ...args);
}
/* eslint-enable no-console */

/** Compact per-entity counts, e.g. `clients:c1/u0/d0 template_items:c14/u0/d0`. Omits
 * empty entities so the FK-relevant ones stand out. */
export function envelopeSummary(envelope: Partial<ChangeEnvelope> | undefined): string {
  if (!envelope) return '(none)';
  const parts: string[] = [];
  for (const table of SYNC_TABLES) {
    const e = envelope[table] as Partial<EntityChanges> | undefined;
    if (!e) continue;
    const c = e.created?.length ?? 0;
    const u = e.updated?.length ?? 0;
    const d = e.deleted?.length ?? 0;
    if (c || u || d) parts.push(`${table}:c${c}/u${u}/d${d}`);
  }
  return parts.length ? parts.join(' ') : '(empty)';
}

type EnvelopeSlot = { bucket: 'created' | 'updated' | 'deleted'; row?: WireRow };

/** Index an envelope's rows by `id` per table, tagging which bucket each came from. */
function indexEnvelope(envelope: ChangeEnvelope): Record<string, Map<string, EnvelopeSlot>> {
  const indexes: Record<string, Map<string, EnvelopeSlot>> = {};
  for (const table of SYNC_TABLES) {
    const e = envelope[table] as Partial<EntityChanges>;
    const map = new Map<string, EnvelopeSlot>();
    for (const row of e.created ?? []) map.set(row.id, { bucket: 'created', row });
    for (const row of e.updated ?? []) map.set(row.id, { bucket: 'updated', row });
    for (const id of e.deleted ?? []) map.set(id, { bucket: 'deleted' });
    indexes[table] = map;
  }
  return indexes;
}

/**
 * Cross-check the server's `rejected` rows against the push envelope we actually sent — the
 * decisive diagnostic for `*_not_found` rejections. For each (entity, reason) it reports,
 * over the rejected rows: where the *parent* the reason names was in our push
 * (`created`/`updated`/`deleted`/absent), whether that parent was **itself rejected**
 * (a cascade), and whether the rejected row was even in our push (`self-not-in-push`,
 * which would mean the server invented it). The reason `<fk>_not_found` is matched back to
 * the FK edge, so each line speaks to exactly the parent the server couldn't resolve.
 *
 * Reading it: `parent updated=N` with the backend applying all `created` before all
 * `updated` is the smoking gun for closure-sent parents missing their children; `absent=N`
 * means the client never sent the parent; `parent-also-rejected=N` is pure cascade.
 */
export function rejectionReport(envelope: ChangeEnvelope, rejected: RejectedRow[]): string {
  if (!rejected.length) return '(none rejected)';
  const indexes = indexEnvelope(envelope);
  const rejectedKeys = new Set(rejected.map((r) => `${r.entity}:${r.id}`));

  type Agg = {
    count: number;
    created: number;
    updated: number;
    deleted: number;
    absent: number;
    parentRejected: number;
    selfMissing: number;
  };
  const groups = new Map<string, Agg>();
  const blank = (): Agg => ({
    count: 0, created: 0, updated: 0, deleted: 0, absent: 0, parentRejected: 0, selfMissing: 0,
  });

  for (const rej of rejected) {
    const key = `${rej.entity}/${rej.reason}`;
    const agg = groups.get(key) ?? blank();
    agg.count += 1;

    const self = indexes[rej.entity]?.get(rej.id);
    if (!self) agg.selfMissing += 1;

    // Match `<fk>_not_found` back to the specific parent edge, else fall back to all edges.
    const fk = rej.reason.endsWith('_not_found') ? rej.reason.slice(0, -'_not_found'.length) : null;
    const edges = (PARENT_EDGES[rej.entity as SyncTable] ?? []).filter((e) => !fk || e.fk === fk);

    for (const edge of edges) {
      const parentId = self?.row?.[edge.fk];
      if (typeof parentId !== 'string' || !parentId) {
        agg.absent += 1; // the FK we'd need wasn't even on the row we sent
        continue;
      }
      const parent = indexes[edge.table]?.get(parentId);
      if (!parent) agg.absent += 1;
      else agg[parent.bucket] += 1;
      if (rejectedKeys.has(`${edge.table}:${parentId}`)) agg.parentRejected += 1;
    }
    groups.set(key, agg);
  }

  const lines = [...groups.entries()].map(([key, a]) => {
    const extras: string[] = [];
    if (a.parentRejected) extras.push(`parent-also-rejected=${a.parentRejected}`);
    if (a.selfMissing) extras.push(`self-not-in-push=${a.selfMissing}`);
    const tail = extras.length ? ` | ${extras.join(' ')}` : '';
    return `  ${key} ×${a.count} → parent in push: created=${a.created} updated=${a.updated} deleted=${a.deleted} absent=${a.absent}${tail}`;
  });
  return lines.join('\n');
}

/**
 * Client-side referential check on a push envelope: returns `template_items.template_id`
 * values that have no matching `templates` row in the same envelope (created or updated).
 * A non-empty result means the client is shipping dangling children — a parent missing
 * from the push. An empty result (parents present) points the FK failure at the server's
 * apply order instead.
 */
export function danglingTemplateRefs(envelope: ChangeEnvelope): string[] {
  const templateIds = new Set(
    [...envelope.templates.created, ...envelope.templates.updated].map((r) => r.id),
  );
  const refs = [...envelope.template_items.created, ...envelope.template_items.updated]
    .map((r) => r.template_id as string)
    .filter((id) => !templateIds.has(id));
  return [...new Set(refs)];
}
