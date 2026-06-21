import { Database, Q } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import MeasurementItem from '@/db/models/MeasurementItem';
import MeasurementValue from '@/db/models/MeasurementValue';
import { nowMs } from '@/lib/time';
import { notDeleted } from './softDelete';

/**
 * Measurement-item repository — home of the append-only history rule (data-model §4).
 *
 * On (re-)measure we compare each entered value to the item's cached `current_value`.
 * Only items whose value ACTUALLY changed get a write: one new immutable
 * `measurement_values` row plus an update to the item's cached current value. Untouched
 * items get no write at all, so "keep the previous sleeve length even though only the
 * sleeve changed" falls out of the structure — no diffing elsewhere.
 */

export type MeasurementEdit = { itemId: string; value: number };
export type SaveResult = { changedItemIds: string[] };

const DEFAULT_UNIT = 'in';
/** Values are exact quarter steps; this epsilon only guards float noise. */
const VALUE_EPSILON = 1e-6;

function hasChanged(current: number | null | undefined, next: number): boolean {
  if (current == null) return true; // never measured → a real value is a change
  return Math.abs(current - next) >= VALUE_EPSILON;
}

/**
 * Apply a batch of measurement edits for one set in a single write. For each item whose
 * value changed, append a `measurement_values` row and refresh the item's cached
 * current value; unchanged items are left completely alone. Returns the ids that were
 * actually written. Edits referencing items outside the set (or deleted) are ignored.
 */
export async function saveMeasurements(
  database: Database,
  setId: string,
  edits: MeasurementEdit[],
): Promise<SaveResult> {
  const setItems = await database
    .get<MeasurementItem>(Tables.measurementItems)
    .query(Q.where('set_id', setId), notDeleted)
    .fetch();
  const byId = new Map(setItems.map((item) => [item.id, item]));
  const valuesCol = database.get<MeasurementValue>(Tables.measurementValues);

  const recordedAt = nowMs();
  const changedItemIds: string[] = [];

  await database.write(async () => {
    for (const edit of edits) {
      const item = byId.get(edit.itemId);
      if (!item) continue; // not part of this set / deleted → ignore
      if (!hasChanged(item.currentValue, edit.value)) continue; // unchanged → NO write at all

      await valuesCol.create((v) => {
        v.item!.id = item.id;
        v.value = edit.value;
        v.recordedAt = recordedAt;
        v.source = 'manual';
      });
      await item.update((it) => {
        it.currentValue = edit.value;
        it.currentValueAt = recordedAt;
      });
      changedItemIds.push(item.id);
    }
  });

  return { changedItemIds };
}

/**
 * Quick-edit a single item from the set-detail screen. Goes through the same
 * history-writing path. Returns true if the value changed (and thus history was written).
 */
export async function quickEditItem(
  database: Database,
  itemId: string,
  value: number,
): Promise<boolean> {
  const item = await database.get<MeasurementItem>(Tables.measurementItems).find(itemId);
  const result = await saveMeasurements(database, item.set.id, [{ itemId, value }]);
  return result.changedItemIds.length > 0;
}

/**
 * Add an ad-hoc item to a set mid-session (shops improvise, spec §4). Defaults to the
 * end of the list. Pushing the key back into the template is a separate concern
 * (`addTemplateItem` in the templates repo).
 */
export async function addAdHocItem(
  database: Database,
  setId: string,
  input: { key: string; unit?: string; position?: number },
): Promise<MeasurementItem> {
  const existing = await database
    .get<MeasurementItem>(Tables.measurementItems)
    .query(Q.where('set_id', setId), notDeleted)
    .fetch();
  const maxPos = existing.reduce((m, it) => Math.max(m, it.position), -1);
  const position = input.position ?? maxPos + 1;
  return database.write(() =>
    database.get<MeasurementItem>(Tables.measurementItems).create((it) => {
      it.set!.id = setId;
      it.key = input.key.trim();
      it.position = position;
      it.unit = input.unit ?? DEFAULT_UNIT;
    }),
  );
}

/**
 * An item's value history, newest first (newest = current). This is the timeline shown
 * on the item-history screen (data-model §4/§7).
 */
export async function getItemHistory(
  database: Database,
  itemId: string,
): Promise<MeasurementValue[]> {
  return database
    .get<MeasurementValue>(Tables.measurementValues)
    .query(Q.where('item_id', itemId), Q.sortBy('recorded_at', Q.desc))
    .fetch();
}
