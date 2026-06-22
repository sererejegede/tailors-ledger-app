import { Database } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { Tables } from '@/db/schema';
import type Template from '@/db/models/Template';
import type MeasurementValue from '@/db/models/MeasurementValue';
import { templateItems } from '../templates';
import { createClient, DuplicateClientNameError } from '../clients';
import { getItemHistory } from '../items';
import {
  createSetWithMeasurements,
  setItems,
  type NewMeasurementItem,
} from '../sets';

async function defaultTemplate(db: Database): Promise<Template> {
  const templates = await db.get<Template>(Tables.templates).query().fetch();
  return templates.find((t) => t.isDefault)!;
}

describe('createSetWithMeasurements (lazy create — no empty drafts)', () => {
  async function itemsFromTemplate(db: Database, templateId: string): Promise<NewMeasurementItem[]> {
    const tItems = await templateItems(db, templateId);
    return tItems.map((t) => ({ key: t.key, position: t.position, unit: t.unit, value: null }));
  }

  it('measure-first: creates a single named client, the set, and value rows only for measured items', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const template = await defaultTemplate(db);
    const clientsBefore = await db.get(Tables.clients).query().fetch();

    const items = await itemsFromTemplate(db, template.id);
    items[0].value = 16.5; // measure exactly one item

    const set = await createSetWithMeasurements(db, {
      templateId: template.id,
      clientName: 'Tunde',
      label: 'Agbada',
      items,
    });

    // The set snapshots the template name and carries the label.
    expect(set.templateNameSnapshot).toBe(template.name);
    expect(set.label).toBe('Agbada');

    // Exactly one new client, and it is named (no blank placeholder).
    const clientsAfter = await db.get(Tables.clients).query().fetch();
    expect(clientsAfter.length).toBe(clientsBefore.length + 1);
    const client = await set.client.fetch();
    expect(client.name).toBe('Tunde');

    // Items copied in order; only the measured one carries a current value.
    const created = await setItems(db, set.id);
    expect(created.map((i) => i.key)).toEqual(items.map((i) => i.key));
    expect(created[0].currentValue).toBe(16.5);
    expect(created.slice(1).every((i) => i.currentValue == null)).toBe(true);

    // Append-only history: exactly one value row total (the single measured item).
    const allValues = await db.get<MeasurementValue>(Tables.measurementValues).query().fetch();
    expect(allValues.length).toBe(1);
    const history = await getItemHistory(db, created[0].id);
    expect(history.map((v) => v.value)).toEqual([16.5]);
  });

  it('client-first: reuses the existing client and creates no new client', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const template = await defaultTemplate(db);
    const client = await createClient(db, { name: 'Ada' });
    const clientsBefore = await db.get(Tables.clients).query().fetch();

    const set = await createSetWithMeasurements(db, {
      templateId: template.id,
      clientId: client.id,
      items: await itemsFromTemplate(db, template.id),
    });

    expect((await set.client.fetch()).id).toBe(client.id);
    const clientsAfter = await db.get(Tables.clients).query().fetch();
    expect(clientsAfter.length).toBe(clientsBefore.length); // none added
  });

  it('rejects a duplicate name and writes nothing', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const template = await defaultTemplate(db);
    await createClient(db, { name: 'Ada' });
    const setsBefore = await db.get(Tables.measurementSets).query().fetch();

    await expect(
      createSetWithMeasurements(db, {
        templateId: template.id,
        clientName: 'ada', // case-insensitive clash
        items: await itemsFromTemplate(db, template.id),
      }),
    ).rejects.toBeInstanceOf(DuplicateClientNameError);

    // The name check runs before the write, so no set is created.
    const setsAfter = await db.get(Tables.measurementSets).query().fetch();
    expect(setsAfter.length).toBe(setsBefore.length);
  });
});
