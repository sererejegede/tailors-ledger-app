import { Database, Q } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import Client from '@/db/models/Client';
import Template from '@/db/models/Template';
import TemplateItem from '@/db/models/TemplateItem';
import MeasurementSet from '@/db/models/MeasurementSet';
import MeasurementItem from '@/db/models/MeasurementItem';
import { notDeleted, softDeleteById } from './softDelete';
import { templateItems } from './templates';
import { assertNameAvailable, type NewClient } from './clients';

/**
 * Measurement-set repository. A set is one garment's worth of measurements for a client,
 * created from a template with an optional label (spec §3). Supports both flows:
 *  - client-first: `createSetFromTemplate({ clientId, ... })`.
 *  - measure-first: `createDraftSet(...)` makes an unnamed draft (a placeholder client
 *    with an empty name, since `client_id` is a required FK and the set→client relation
 *    is immutable), then `attachClient(setId, { name })` names that client on save
 *    (spec §4).
 */

export type NewSetFromTemplate = { clientId: string; templateId: string; label?: string };
export type NewDraftSet = { templateId: string; label?: string };

/**
 * Create the set row + copy the template's items into `measurement_items` in order.
 * Assumes it is already running inside a `database.write`.
 */
async function createSetAndItems(
  database: Database,
  clientId: string,
  template: Template,
  tItems: TemplateItem[],
  label?: string,
): Promise<MeasurementSet> {
  const set = await database.get<MeasurementSet>(Tables.measurementSets).create((s) => {
    s.client!.id = clientId;
    s.templateId = template.id;
    s.templateNameSnapshot = template.name; // denormalized so the set still reads if the template changes
    if (label != null) s.label = label;
  });
  const itemsCol = database.get<MeasurementItem>(Tables.measurementItems);
  await Promise.all(
    tItems.map((ti) =>
      itemsCol.create((mi) => {
        mi.set!.id = set.id;
        mi.key = ti.key;
        mi.position = ti.position;
        mi.unit = ti.unit;
        // current_value stays null until first measured
      }),
    ),
  );
  return set;
}

export async function createSetFromTemplate(
  database: Database,
  input: NewSetFromTemplate,
): Promise<MeasurementSet> {
  const template = await database.get<Template>(Tables.templates).find(input.templateId);
  const tItems = await templateItems(database, input.templateId);
  return database.write(() =>
    createSetAndItems(database, input.clientId, template, tItems, input.label),
  );
}

/**
 * Start an unnamed draft set (measure-first). Creates a placeholder client (empty name)
 * to satisfy the required, immutable `client_id`; `attachClient` names it on save.
 */
export async function createDraftSet(
  database: Database,
  input: NewDraftSet,
): Promise<MeasurementSet> {
  const template = await database.get<Template>(Tables.templates).find(input.templateId);
  const tItems = await templateItems(database, input.templateId);
  return database.write(async () => {
    const client = await database.get<Client>(Tables.clients).create((c) => {
      c.name = '';
    });
    return createSetAndItems(database, client.id, template, tItems, input.label);
  });
}

/** Name the draft's placeholder client (attach-a-name flow). Returns the client. */
export async function attachClient(
  database: Database,
  setId: string,
  input: NewClient,
): Promise<Client> {
  const set = await database.get<MeasurementSet>(Tables.measurementSets).find(setId);
  const client = await set.client.fetch();
  await assertNameAvailable(database, input.name, client.id);
  await database.write(async () => {
    await client.update((c) => {
      c.name = input.name.trim();
      if (input.phone != null) c.phone = input.phone;
      if (input.comment != null) c.comment = input.comment;
    });
  });
  return client;
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
): Promise<MeasurementSet[]> {
  return database
    .get<MeasurementSet>(Tables.measurementSets)
    .query(Q.where('client_id', clientId), notDeleted, Q.sortBy('created_at', Q.desc))
    .fetch();
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
