import { Database, Model } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';

/**
 * Local data-integrity maintenance: purge **orphaned** rows — pending (never-synced) records
 * whose required parent no longer exists locally. These are residue from the pre-lazy-create
 * "empty draft" era + manual cleanup that removed parent clients/sets/templates without
 * cascading to their children. They can never sync (the server rejects them
 * `<fk>_not_found`, correctly), so they just poison every push. Because they were never
 * synced, they're hard-deleted with no tombstone (the server never knew them).
 *
 * This mirrors the orphan checks in scripts/inspect-device-db.cjs, applied as a cascade:
 * a deleted parent orphans its children, so the plan runs parents→children and each table's
 * check treats earlier-planned deletions as already gone.
 */

type PurgeEdge = {
  parent: string;
  fk: string;
  /** Treat a *soft-deleted* parent as missing too (used for template_items: a deleted
   * template's leftover pending items should go with it). Off elsewhere — e.g. a set is a
   * soft reference to its template and must survive template deletion (data-model §3). */
  orphanIfParentSoftDeleted?: boolean;
};

/** Parents→children so a purged parent cascades to its now-orphaned children in one pass. */
const PURGE_PLAN: { table: string; edges: PurgeEdge[] }[] = [
  { table: Tables.measurementSets, edges: [{ parent: Tables.clients, fk: 'client_id' }] },
  {
    table: Tables.templateItems,
    edges: [{ parent: Tables.templates, fk: 'template_id', orphanIfParentSoftDeleted: true }],
  },
  { table: Tables.images, edges: [{ parent: Tables.measurementSets, fk: 'set_id' }] },
  { table: Tables.measurementItems, edges: [{ parent: Tables.measurementSets, fk: 'set_id' }] },
  { table: Tables.measurementValues, edges: [{ parent: Tables.measurementItems, fk: 'item_id' }] },
];

export type PurgeReport = { total: number } & Record<string, number>;

function raw(record: Model): Record<string, unknown> {
  return record._raw as Record<string, unknown>;
}

/**
 * Compute the doomed rows per table without deleting anything — a dry run. Simulates the
 * cascade in memory (a row planned for deletion is treated as gone when checking its
 * children), so the counts match what `purgeOrphans` would remove.
 */
async function findOrphans(database: Database): Promise<{ table: string; rows: Model[] }[]> {
  const plannedDeleted: Record<string, Set<string>> = {};
  const out: { table: string; rows: Model[] }[] = [];

  for (const { table, edges } of PURGE_PLAN) {
    const liveParents: Record<string, Set<string>> = {};
    for (const e of edges) {
      const parentRows = await database.get(e.parent).query().fetch();
      const gone = plannedDeleted[e.parent] ?? new Set<string>();
      liveParents[e.parent] = new Set(
        parentRows
          .filter((p) => !gone.has(p.id))
          .filter((p) => !e.orphanIfParentSoftDeleted || raw(p).deleted_at == null)
          .map((p) => p.id),
      );
    }

    const rows = await database.get(table).query().fetch();
    const doomed = rows.filter((r) => {
      if (r.syncStatus === 'synced') return false; // only ever purge never-synced junk
      if (raw(r).deleted_at != null) return false; // already a tombstone
      return edges.some((e) => {
        const parentId = raw(r)[e.fk];
        if (typeof parentId !== 'string' || !parentId) return false; // null/optional FK
        return !liveParents[e.parent].has(parentId);
      });
    });

    plannedDeleted[table] = new Set(doomed.map((r) => r.id));
    out.push({ table, rows: doomed });
  }

  return out;
}

function tally(found: { table: string; rows: Model[] }[]): PurgeReport {
  const report = { total: 0 } as PurgeReport;
  for (const { table, rows } of found) {
    report[table] = rows.length;
    report.total += rows.length;
  }
  return report;
}

/** Count orphaned rows without removing anything (drives a confirm prompt). */
export async function countOrphans(database: Database): Promise<PurgeReport> {
  return tally(await findOrphans(database));
}

/** Hard-delete all orphaned pending rows in one batch. Returns what was removed. */
export async function purgeOrphans(database: Database): Promise<PurgeReport> {
  const found = await findOrphans(database);
  const doomed = found.flatMap((f) => f.rows);
  if (doomed.length) {
    await database.write(async () => {
      await database.batch(doomed.map((r) => r.prepareDestroyPermanently()));
    });
  }
  return tally(found);
}
