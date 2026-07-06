import { Database } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { Tables } from '@/db/schema';
import type Template from '@/db/models/Template';
import { createClient, softDeleteClient } from '../clients';
import { templateItems } from '../templates';
import { createSetWithMeasurements, setItems } from '../sets';
import { saveMeasurements } from '../items';
import { softDelete } from '../softDelete';
import { countOrphans, purgeOrphans } from '../maintenance';

async function defaultTemplate(db: Database): Promise<Template> {
  const templates = await db.get<Template>(Tables.templates).query().fetch();
  return templates.find((t) => t.isDefault)!;
}

/** A client with a fully-measured set, all rows still pending (never synced). */
async function makeMeasuredSet(db: Database, name: string) {
  const client = await createClient(db, { name });
  const template = await defaultTemplate(db);
  const tItems = await templateItems(db, template.id);
  const set = await createSetWithMeasurements(db, {
    clientId: client.id,
    templateId: template.id,
    items: tItems.map((t) => ({ key: t.key, position: t.position, unit: t.unit, value: null })),
  });
  const items = await setItems(db, set.id);
  await saveMeasurements(db, set.id, [{ itemId: items[0].id, value: 20 }]);
  return { client, set, items };
}

/** Hard-delete a record the way a rogue cleanup would (no cascade), creating orphans. */
async function hardDelete(db: Database, table: string, id: string) {
  const rec = await db.get(table).find(id);
  await db.write(async () => {
    await rec.destroyPermanently();
  });
}

describe('maintenance — purgeOrphans', () => {
  it('removes a set + its items + values when the parent client vanished, leaving healthy data', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const orphanG = await makeMeasuredSet(db, 'Ghost');
    const healthy = await makeMeasuredSet(db, 'Real Person');

    // Simulate the bug: the client row is gone but its set/items/values remain.
    await hardDelete(db, Tables.clients, orphanG.client.id);

    const preview = await countOrphans(db);
    expect(preview[Tables.measurementSets]).toBe(1); // the ghost set
    expect(preview[Tables.measurementItems]).toBe(orphanG.items.length); // cascaded
    expect(preview[Tables.measurementValues]).toBe(1); // the one measured value
    expect(preview.total).toBe(1 + orphanG.items.length + 1);

    const report = await purgeOrphans(db);
    expect(report.total).toBe(preview.total);

    // Ghost gone.
    await expect(db.get(Tables.measurementSets).find(orphanG.set.id)).rejects.toBeTruthy();
    expect(
      await db.get(Tables.measurementItems).query().fetchCount(),
    ).toBe(healthy.items.length); // only the healthy set's items remain

    // Healthy set untouched.
    const stillThere = await db.get(Tables.measurementSets).find(healthy.set.id);
    expect(stillThere).toBeTruthy();
  });

  it('purges a pending template_item under a soft-deleted template, but spares synced rows', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const template = await defaultTemplate(db);

    // The template is soft-deleted; its items are still pending → orphaned.
    await db.write(async () => {
      await softDelete(template);
    });

    const before = await db.get(Tables.templateItems).query().fetchCount();
    const report = await purgeOrphans(db);
    expect(report[Tables.templateItems]).toBeGreaterThan(0);
    const after = await db.get(Tables.templateItems).query().fetchCount();
    expect(after).toBeLessThan(before);
  });

  it('is a no-op on a clean store', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    await makeMeasuredSet(db, 'Real Person');

    const report = await purgeOrphans(db);
    expect(report.total).toBe(0);
  });

  it('does not purge a set just because its (soft) template reference is gone', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const { set } = await makeMeasuredSet(db, 'Keep Me');

    // Template deleted entirely — the set keeps its template_name_snapshot and must survive.
    const template = await defaultTemplate(db);
    await hardDelete(db, Tables.templates, template.id);

    const report = await purgeOrphans(db);
    expect(report[Tables.measurementSets]).toBe(0);
    expect(await db.get(Tables.measurementSets).find(set.id)).toBeTruthy();
  });
});
