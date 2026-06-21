import { Database, Model, Q } from '@nozbe/watermelondb';
import { nowMs } from '@/lib/time';

/**
 * Soft-delete primitives. Deletes on device are tombstones (`deleted_at`), never
 * hard-deletes — they propagate on sync, then get purged server-side (locked decision,
 * data-model §1/§2). `measurement_values` is exempt (append-only, no `deleted_at`).
 */

/** Query clause selecting rows that are NOT soft-deleted (`deleted_at IS NULL`). */
export const notDeleted = Q.where('deleted_at', null);

type SoftDeletable = Model & { deletedAt?: Date };

/**
 * Stamp `deleted_at = now` on a record. Must run inside a `database.write` — the repo
 * wrappers (e.g. `softDeleteById`) open the writer for you.
 */
export async function softDelete(record: SoftDeletable): Promise<void> {
  await record.update((r) => {
    (r as SoftDeletable).deletedAt = new Date(nowMs());
  });
}

/** Find a record by id and soft-delete it in its own write. */
export async function softDeleteById<T extends SoftDeletable>(
  database: Database,
  table: string,
  id: string,
): Promise<void> {
  const record = await database.get<T>(table).find(id);
  await database.write(async () => {
    await softDelete(record);
  });
}
