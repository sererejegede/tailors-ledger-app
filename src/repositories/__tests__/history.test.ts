import { Database, Q } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { Tables } from '@/db/schema';
import type Template from '@/db/models/Template';
import { createClient } from '../clients';
import { templateItems } from '../templates';
import { createSetWithMeasurements, setItems } from '../sets';
import { saveMeasurements, quickEditItem, getItemHistory, MeasurementEdit } from '../items';

/** Raw count of value rows for an item (getItemHistory excludes the current value). */
async function valueCount(db: Database, itemId: string): Promise<number> {
  return db.get(Tables.measurementValues).query(Q.where('item_id', itemId)).fetchCount();
}

async function defaultTemplate(db: Database): Promise<Template> {
  const templates = await db.get<Template>(Tables.templates).query().fetch();
  return templates.find((t) => t.isDefault)!;
}

/** Seed a set from the default template and give every item an initial value. */
async function freshlyMeasuredSet(db: Database) {
  await ensureSeeded(db);
  const client = await createClient(db, { name: 'Tunde Bello' });
  const template = await defaultTemplate(db);
  const tItems = await templateItems(db, template.id);
  const set = await createSetWithMeasurements(db, {
    clientId: client.id,
    templateId: template.id,
    label: 'Wedding agbada',
    items: tItems.map((t) => ({ key: t.key, position: t.position, unit: t.unit, value: null })),
  });
  const items = await setItems(db, set.id);
  const firstEdits: MeasurementEdit[] = items.map((it, i) => ({
    itemId: it.id,
    value: 20 + i * 0.5,
  }));
  await saveMeasurements(db, set.id, firstEdits);
  return { set, items, firstEdits };
}

describe('saveMeasurements — append-only history rule', () => {
  it('first measure writes one value row per item and caches the current value', async () => {
    const db = makeTestDatabase();
    const { set, items, firstEdits } = await freshlyMeasuredSet(db);

    const totalValues = await db.get(Tables.measurementValues).query().fetchCount();
    expect(totalValues).toBe(items.length);

    const reloaded = await setItems(db, set.id);
    for (let i = 0; i < reloaded.length; i++) {
      expect(reloaded[i].currentValue).toBeCloseTo(firstEdits[i].value, 6);
      expect(reloaded[i].currentValueAt).toBeGreaterThan(0);
      // One value row written; no EARLIER values yet (getItemHistory excludes the current).
      expect(await valueCount(db, reloaded[i].id)).toBe(1);
      expect(await getItemHistory(db, reloaded[i].id)).toHaveLength(0);
    }
  });

  it('re-measuring only one item writes history for THAT item and nothing else', async () => {
    const db = makeTestDatabase();
    const { set, items, firstEdits } = await freshlyMeasuredSet(db);

    // Re-open the set and re-submit every item's value, changing only the sleeve.
    const sleeveIdx = items.findIndex((it) => it.key === 'Sleeve length');
    expect(sleeveIdx).toBeGreaterThanOrEqual(0);
    const sleeveId = items[sleeveIdx].id;
    const oldSleeve = firstEdits[sleeveIdx].value;
    const newSleeve = oldSleeve + 0.25;

    const reEdits: MeasurementEdit[] = firstEdits.map((e, i) =>
      i === sleeveIdx ? { itemId: e.itemId, value: newSleeve } : e,
    );
    const result = await saveMeasurements(db, set.id, reEdits);

    // Only the sleeve was written.
    expect(result.changedItemIds).toEqual([sleeveId]);

    // Exactly one new value row overall.
    const totalValues = await db.get(Tables.measurementValues).query().fetchCount();
    expect(totalValues).toBe(items.length + 1);

    // Sleeve now has two value rows; its single EARLIER value is the preserved old one.
    expect(await valueCount(db, sleeveId)).toBe(2);
    const sleeveHistory = await getItemHistory(db, sleeveId);
    expect(sleeveHistory).toHaveLength(1);
    expect(sleeveHistory[0].value).toBeCloseTo(oldSleeve, 6);

    // Every other item is untouched: still one row, no earlier values, original current.
    const reloaded = await setItems(db, set.id);
    for (let i = 0; i < reloaded.length; i++) {
      if (reloaded[i].id === sleeveId) {
        expect(reloaded[i].currentValue).toBeCloseTo(newSleeve, 6);
      } else {
        expect(reloaded[i].currentValue).toBeCloseTo(firstEdits[i].value, 6);
        expect(await valueCount(db, reloaded[i].id)).toBe(1);
        expect(await getItemHistory(db, reloaded[i].id)).toHaveLength(0);
      }
    }
  });

  it('re-submitting identical values writes nothing', async () => {
    const db = makeTestDatabase();
    const { set, firstEdits } = await freshlyMeasuredSet(db);

    const result = await saveMeasurements(db, set.id, firstEdits);
    expect(result.changedItemIds).toEqual([]);

    const totalValues = await db.get(Tables.measurementValues).query().fetchCount();
    expect(totalValues).toBe(firstEdits.length); // unchanged from the first measure
  });
});

describe('quickEditItem', () => {
  it('writes history when the value changes and is a no-op when it does not', async () => {
    const db = makeTestDatabase();
    const { items, firstEdits } = await freshlyMeasuredSet(db);
    const target = items[0];

    const changed = await quickEditItem(db, target.id, firstEdits[0].value + 0.5);
    expect(changed).toBe(true);
    // Two value rows total; one earlier value (the pre-edit measurement).
    expect(await valueCount(db, target.id)).toBe(2);
    expect(await getItemHistory(db, target.id)).toHaveLength(1);

    const again = await quickEditItem(db, target.id, firstEdits[0].value + 0.5);
    expect(again).toBe(false);
    expect(await valueCount(db, target.id)).toBe(2);
    expect(await getItemHistory(db, target.id)).toHaveLength(1);
  });
});
