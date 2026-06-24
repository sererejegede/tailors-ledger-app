import { Database, Q } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import Client from '@/db/models/Client';
import Template from '@/db/models/Template';
import MeasurementSet from '@/db/models/MeasurementSet';
import MeasurementItem from '@/db/models/MeasurementItem';
import MeasurementValue from '@/db/models/MeasurementValue';
import { nowMs } from '@/lib/time';
import { notDeleted, softDeleteById } from './softDelete';
import { assertNameAvailable } from './clients';

/**
 * Measurement-set repository. A set is one garment's worth of measurements for a client,
 * created from a template with an optional label (spec §3).
 *
 * Both entry flows funnel through `createSetWithMeasurements`, which writes the set (and,
 * for measure-first, the client) only at save time — see "lazy create", data-model §1a.
 * Nothing is persisted while a session is in progress, so abandoned sessions leave no
 * empty rows behind.
 */

/**
 * Lazy create: build a set and its measured values in one shot, only at save time. This
 * is how the measurement-entry screen avoids flooding the store with empty drafts — no
 * client/set/item rows exist until the tailor actually saves (spec §4, "non-blocking").
 *
 * The client is either an existing one (`clientId`, client-first flow) or created fresh
 * from a non-blank `clientName` (measure-first, named on save). We never write a blank
 * placeholder client. Only items with a value get a `measurement_values` row + a cached
 * current value; untouched items are created empty (current_value null), same as a
 * template-seeded set.
 */
export type NewMeasurementItem = { key: string; position: number; unit?: string; value: number | null };
export type MeasurementSetWithItemsCount = { set: MeasurementSet; itemsCount: number };
export type CreateSetWithMeasurements = {
  templateId: string;
  label?: string;
  items: NewMeasurementItem[];
} & ({ clientId: string } | { clientName: string });

export async function createSetWithMeasurements(
  database: Database,
  input: CreateSetWithMeasurements,
): Promise<MeasurementSet> {
  const template = await database.get<Template>(Tables.templates).find(input.templateId);
  // Validate the name BEFORE opening the write — assertNameAvailable queries, and
  // WatermelonDB writes can't nest. Throws DuplicateClientNameError on a clash.
  if ('clientName' in input) await assertNameAvailable(database, input.clientName);

  return database.write(async () => {
    let clientId: string;
    if ('clientId' in input) {
      clientId = input.clientId;
    } else {
      const client = await database.get<Client>(Tables.clients).create((c) => {
        c.name = input.clientName.trim();
      });
      clientId = client.id;
    }

    const set = await database.get<MeasurementSet>(Tables.measurementSets).create((s) => {
      s.client!.id = clientId;
      s.templateId = template.id;
      s.templateNameSnapshot = template.name;
      if (input.label != null) s.label = input.label;
    });

    const itemsCol = database.get<MeasurementItem>(Tables.measurementItems);
    const valuesCol = database.get<MeasurementValue>(Tables.measurementValues);
    const recordedAt = nowMs();
    for (const it of input.items) {
      const item = await itemsCol.create((mi) => {
        mi.set!.id = set.id;
        mi.key = it.key;
        mi.position = it.position;
        mi.unit = it.unit ?? 'in';
        if (it.value != null) {
          mi.currentValue = it.value;
          mi.currentValueAt = recordedAt;
        }
      });
      if (it.value != null) {
        const value = it.value;
        await valuesCol.create((v) => {
          v.item!.id = item.id;
          v.value = value;
          v.recordedAt = recordedAt;
          v.source = 'manual';
        });
      }
    }
    return set;
  });
}

export async function updateSet(
  database: Database,
  id: string,
  patch: { label?: string; note?: string },
): Promise<MeasurementSet> {
  const set = await database.get<MeasurementSet>(Tables.measurementSets).find(id);
  await database.write(async () => {
    await set.update((s) => {
      if (patch.label !== undefined) s.label = patch.label;
      if (patch.note !== undefined) s.note = patch.note;
    });
  });
  return set;
}

export async function softDeleteSet(database: Database, id: string): Promise<void> {
  await softDeleteById<MeasurementSet>(database, Tables.measurementSets, id);
}

/** A client's sets, newest first, excluding tombstones (Client detail, spec §6). */
export async function setsForClient(
  database: Database,
  clientId: string,
): Promise<MeasurementSetWithItemsCount[]> {
  const [sets, measuredItems] = await Promise.all([
    database
      .get<MeasurementSet>(Tables.measurementSets)
      .query(Q.where('client_id', clientId), notDeleted, Q.sortBy('created_at', Q.desc))
      .fetch(),
    database
      .get<MeasurementItem>(Tables.measurementItems)
      .query(
        Q.on(Tables.measurementSets, [Q.where('client_id', clientId), notDeleted]),
        notDeleted,
        Q.where('current_value', Q.notEq(null)),
      )
      .fetch(),
  ]);

  const itemCountsBySetId = new Map<string, number>();
  for (const item of measuredItems) {
    const setId = item.set.id;
    itemCountsBySetId.set(setId, (itemCountsBySetId.get(setId) ?? 0) + 1);
  }

  return sets.map((set) => ({ set, itemsCount: itemCountsBySetId.get(set.id) ?? 0 }));
}

export type SetWithClient = { set: MeasurementSet; client: string };

/** A set together with its (eagerly loaded) client, for the set-detail header. */
export async function getSet(database: Database, id: string): Promise<SetWithClient> {
  const set = await database.get<MeasurementSet>(Tables.measurementSets).find(id);
  const client = await set.client;
  return { set, client: client.name };
}

/** A set's items in template/position order (the measurement-entry list). */
export async function setItems(
  database: Database,
  setId: string,
): Promise<MeasurementItem[]> {
  return database
    .get<MeasurementItem>(Tables.measurementItems)
    .query(Q.where('set_id', setId), notDeleted, Q.sortBy('position', Q.asc))
    .fetch();
}
