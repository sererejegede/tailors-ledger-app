import { Database, Model } from '@nozbe/watermelondb';
import { findOrphans } from '@/repositories/maintenance';
import { ensureSeeded } from '@/db/seed';
import { legacySeedIds, reconcileDefaultTemplate } from './seedReconcile';
import { SYNC_TABLES, type RejectedRow, type SyncTable } from './types';

/**
 * Clean-up for rows the server keeps rejecting because they can never sync to this account
 * (data model §1d). Two cases qualify, and only these:
 *
 *  - **`id_conflict`**: the server already holds that id under another account, so the row
 *    is backed up there. Everything hanging off it goes too: the server would reject each of
 *    those as a missing parent, and without the row they'd be stranded on the phone.
 *  - **Orphans**: rejected as `<fk>_not_found` while the parent is also missing on this
 *    phone (the same check as Settings' existing orphan clean-up).
 *
 * The server checks ownership before parents, so anything rejected as a missing parent isn't
 * on any account. Those rows, and edits made here to a row backed up elsewhere, are listed
 * separately as "will be lost". Nothing is removed without the tailor's confirm.
 */

/** The parent links the server enforces (backend `entities.ts`). Unlike PARENT_EDGES, sets →
 * templates is left out: it's a soft reference, so sets made from another account's template
 * stay. */
const HARD_EDGES: Partial<Record<SyncTable, { table: SyncTable; fk: string }>> = {
  template_items: { table: 'templates', fk: 'template_id' },
  measurement_sets: { table: 'clients', fk: 'client_id' },
  measurement_items: { table: 'measurement_sets', fk: 'set_id' },
  measurement_values: { table: 'measurement_items', fk: 'item_id' },
  images: { table: 'measurement_sets', fk: 'set_id' },
  jobs: { table: 'clients', fk: 'client_id' },
  job_items: { table: 'jobs', fk: 'job_id' },
  payments: { table: 'jobs', fk: 'job_id' },
};

const NOUN: Record<SyncTable, string> = {
  clients: 'client',
  templates: 'template',
  template_items: 'template item',
  measurement_sets: 'measurement set',
  measurement_items: 'measurement item',
  measurement_values: 'measurement',
  images: 'photo',
  jobs: 'job',
  job_items: 'job item',
  payments: 'payment',
};

/** Folded into their set / template in the text; shown only when nothing else is. */
const DETAIL_TABLES = new Set<SyncTable>(['measurement_items', 'template_items']);

export type CleanupPlan = {
  rows: { table: SyncTable; id: string }[];
  /** One line per client (or template): data already backed up on another account. */
  backedUp: string[];
  /** One line per client (or template): made or changed on this phone, backed up nowhere. */
  notBackedUp: string[];
  /** The exact rows, so a confirm only ever removes what it showed. */
  signature: string;
};

type Entry = { table: SyncTable; record: Model; raw: Record<string, unknown> };
type Why = 'conflict' | 'descendant' | 'orphan';

const key = (table: string, id: string) => `${table}:${id}`;

export async function planRejectedCleanup(
  database: Database,
  rejected: RejectedRow[],
): Promise<CleanupPlan | null> {
  const conflicts = new Set<string>();
  const missingParent = new Set<string>();
  for (const r of rejected) {
    if (!r.id) continue;
    if (r.reason === 'id_conflict') conflicts.add(key(r.entity, r.id));
    else if (r.reason.endsWith('_not_found')) missingParent.add(key(r.entity, r.id));
  }
  if (!conflicts.size && !missingParent.size) return null;

  const all = new Map<string, Entry>();
  const children = new Map<string, string[]>();
  for (const table of SYNC_TABLES) {
    for (const record of await database.get(table).query().fetch()) {
      const raw = record._raw as Record<string, unknown>;
      const k = key(table, record.id);
      all.set(k, { table, record, raw });
      const edge = HARD_EDGES[table];
      const parentId = edge ? raw[edge.fk] : null;
      if (edge && typeof parentId === 'string' && parentId) {
        const pk = key(edge.table, parentId);
        children.set(pk, [...(children.get(pk) ?? []), k]);
      }
    }
  }

  const doomed = new Map<string, Why>();
  const legacy = legacySeedIds(); // another user's copy of the old fixed-id starters, not ours
  for (const k of conflicts) {
    const entry = all.get(k);
    if (entry && entry.record.syncStatus !== 'synced' && !legacy.has(entry.record.id)) doomed.set(k, 'conflict');
  }
  for (const { table, rows } of await findOrphans(database)) {
    for (const record of rows) {
      const k = key(table, record.id);
      if (missingParent.has(k) && !doomed.has(k)) doomed.set(k, 'orphan');
    }
  }
  if (!doomed.size) return null;

  // Everything hanging off a removed row goes with it.
  const queue = [...doomed.keys()];
  while (queue.length) {
    for (const child of children.get(queue.pop()!) ?? []) {
      if (doomed.has(child)) continue;
      doomed.set(child, 'descendant');
      queue.push(child);
    }
  }

  const backed = new Groups();
  const lost = new Groups();
  for (const [k, why] of doomed) {
    const entry = all.get(k)!;
    const status = entry.record.syncStatus;
    const group = groupOf(entry, all);
    if (why === 'orphan' || (why === 'descendant' && status === 'created')) {
      lost.add(group, entry.table, 'new');
    } else if (status !== 'deleted') {
      // An id_conflict row is on another account; a synced row under one is too (the server
      // won't hold a child of another account's row). Edits made here since are not.
      backed.add(group, entry.table, 'new');
      if (status === 'updated') lost.add(group, entry.table, 'edit');
    }
  }

  const rows = [...doomed.keys()].sort().map((k) => ({ table: all.get(k)!.table, id: all.get(k)!.record.id }));
  return {
    rows,
    backedUp: backed.lines(),
    notBackedUp: lost.lines(),
    signature: [...doomed.keys()].sort().join('|'),
  };
}

/**
 * Remove a confirmed plan from this phone. Re-plans first and removes nothing if the rows
 * changed since the tailor saw them (returns `stale`). A hard delete (data model §1d).
 */
export async function applyRejectedCleanup(
  database: Database,
  rejected: RejectedRow[],
  signature: string,
): Promise<{ removed: number; stale: boolean }> {
  const plan = await planRejectedCleanup(database, rejected);
  if (!plan || plan.signature !== signature) return { removed: 0, stale: true };

  await database.write(async () => {
    const ops: Model[] = [];
    for (const { table, id } of plan.rows) ops.push((await database.get(table).find(id)).prepareDestroyPermanently());
    await database.batch(ops);
  });
  await ensureSeeded(database); // in case the last template went
  await reconcileDefaultTemplate(database);
  return { removed: plan.rows.length, stale: false };
}

/** The confirm text for a plan. */
export function cleanupMessage(plan: CleanupPlan): string {
  const parts = [
    'Some data on this phone can’t sync to this account and will be removed from this phone.',
  ];
  if (plan.backedUp.length) {
    parts.push(
      'It belongs to another account and is already backed up there. Signing in to that account brings it back:\n' +
        plan.backedUp.map((l) => `• ${l}`).join('\n'),
    );
  }
  if (plan.notBackedUp.length) {
    parts.push(
      'This was made or changed on this phone and isn’t backed up anywhere. It will be lost:\n' +
        plan.notBackedUp.map((l) => `• ${l}`).join('\n'),
    );
  }
  parts.push('Remove it from this phone?');
  return parts.join('\n\n');
}

// ── describing rows in plain words ──────────────────────────────────────────────────

type Group = { id: string; label: string };

/** The client (or template) a row belongs to, by following its parents on the phone. */
function groupOf(entry: Entry, all: Map<string, Entry>): Group {
  let current: Entry | undefined = entry;
  let table: SyncTable = entry.table;
  let id = entry.record.id;
  while (current && table !== 'clients' && table !== 'templates') {
    const edge: { table: SyncTable; fk: string } = HARD_EDGES[table]!;
    const parentId = current.raw[edge.fk];
    if (typeof parentId !== 'string' || !parentId) break;
    table = edge.table;
    id = parentId;
    current = all.get(key(table, id));
  }
  if (table === 'templates') {
    const name = current?.raw.name;
    return { id: key(table, id), label: name ? `The “${String(name)}” template` : 'A template no longer on this phone' };
  }
  if (table === 'clients' && current) return { id: key(table, id), label: String(current.raw.name || 'A client with no name') };
  return { id: key(table, id), label: 'A client no longer on this phone' };
}

class Groups {
  private groups = new Map<string, { label: string; counts: Map<string, number> }>();

  add(group: Group, table: SyncTable, kind: 'new' | 'edit') {
    const g = this.groups.get(group.id) ?? { label: group.label, counts: new Map<string, number>() };
    const k = `${kind}:${table}`;
    g.counts.set(k, (g.counts.get(k) ?? 0) + 1);
    this.groups.set(group.id, g);
  }

  lines(): string[] {
    return [...this.groups.values()]
      .map(({ label, counts }) => `${label}: ${describe(counts)}`)
      .sort();
  }
}

function describe(counts: Map<string, number>): string {
  const visible = [...counts].filter(([k]) => !DETAIL_TABLES.has(k.split(':')[1] as SyncTable));
  const shown = visible.length ? visible : [...counts];
  const order = (k: string) => (k.startsWith('edit') ? 1 : 0) * 100 + SYNC_TABLES.indexOf(k.split(':')[1] as SyncTable);
  return shown
    .sort(([a], [b]) => order(a) - order(b))
    .map(([k, n]) => {
      const [kind, table] = k.split(':') as ['new' | 'edit', SyncTable];
      const isTop = table === 'clients' || table === 'templates';
      const noun = isTop && n === 1 ? `the ${NOUN[table]}` : `${n} ${NOUN[table]}${n === 1 ? '' : 's'}`;
      return kind === 'edit' ? `edits to ${noun}` : noun;
    })
    .join(', ');
}
