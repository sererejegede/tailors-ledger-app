import { Database } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded, STARTER_TEMPLATES } from '@/db/seed';
import { Tables } from '@/db/schema';
import { createClient } from '@/repositories/clients';
import { createSetWithMeasurements } from '@/repositories/sets';
import { templateItems, updateTemplateItem } from '@/repositories/templates';
import { getSettings } from '@/repositories/settings';
import type Template from '@/db/models/Template';
import type TemplateItem from '@/db/models/TemplateItem';
import type MeasurementSet from '@/db/models/MeasurementSet';
import {
  legacySeedIds,
  reconcileDefaultTemplate,
  reconcileStarterTemplates,
} from '../seedReconcile';
import { addPulledTemplates, seedWithLegacyIds } from './seedFixtures';

const ACCOUNT_MEN = { id: '019f3b2f-a5cd-741c-98dc-f257a3294030', name: 'Men', isDefault: false, updatedAt: 1_785_678_448_780 };
const ACCOUNT_WOMEN = { id: '019f3b2f-a5d0-7a1d-86d4-9a2d6c4ff6b3', name: 'Women', isDefault: true, updatedAt: 1_785_678_448_780 };

const STARTER_ITEM_COUNT = STARTER_TEMPLATES.reduce((sum, starter) => sum + starter.items.length, 0);

async function allTemplates(db: Database): Promise<Template[]> {
  return db.get<Template>(Tables.templates).query().fetch();
}

async function templateNamed(db: Database, name: string): Promise<Template | undefined> {
  return (await allTemplates(db)).find((template) => template.name === name);
}

/** Make Date.now() move forward so an edit gets a later updated_at than the create. */
function advanceClock(byMs: number): () => void {
  const realNow = Date.now();
  const spy = jest.spyOn(Date, 'now').mockReturnValue(realNow + byMs);
  return () => spy.mockRestore();
}

describe('reconcileStarterTemplates', () => {
  it('discards untouched, unreferenced starters when the account already has templates', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    await addPulledTemplates(db, [ACCOUNT_MEN, ACCOUNT_WOMEN]);

    const result = await reconcileStarterTemplates(db);

    expect(result.discarded).toBe(2);
    const names = (await allTemplates(db)).map((template) => template.name).sort();
    expect(names).toEqual(['Men', 'Women']);
    // Their items are gone too, and the settings default moved to the account's default.
    expect(await db.get<TemplateItem>(Tables.templateItems).query().fetchCount()).toBe(0);
    expect((await getSettings(db))?.defaultTemplateId).toBe(ACCOUNT_WOMEN.id);
  });

  it('keeps the starters on an account with no templates yet', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);

    const result = await reconcileStarterTemplates(db);

    expect(result).toEqual({ discarded: 0, rekeyed: 0, demoted: 0 });
    expect(await allTemplates(db)).toHaveLength(2);
    expect(await db.get<TemplateItem>(Tables.templateItems).query().fetchCount()).toBe(
      STARTER_ITEM_COUNT,
    );
  });

  it('keeps a starter a measurement set references, and demotes it from default', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const mens = (await templateNamed(db, "Men's"))!;
    const client = await createClient(db, { name: 'Tunde Bello' });
    const items = await templateItems(db, mens.id);
    await createSetWithMeasurements(db, {
      clientId: client.id,
      templateId: mens.id,
      items: items.map((item) => ({ key: item.key, position: item.position, unit: item.unit, value: null })),
    });
    await addPulledTemplates(db, [ACCOUNT_MEN, ACCOUNT_WOMEN]);

    const result = await reconcileStarterTemplates(db);

    expect(result.discarded).toBe(1); // only the unused Women's
    const keptMens = (await templateNamed(db, "Men's"))!;
    expect(keptMens.id).toBe(mens.id);
    expect(keptMens.isDefault).toBe(false);
    expect(await templateNamed(db, "Women's")).toBeUndefined();
  });

  it('keeps a starter whose items were edited', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const womens = (await templateNamed(db, "Women's"))!;
    const [firstItem] = await templateItems(db, womens.id);
    const restoreClock = advanceClock(5_000);
    await updateTemplateItem(db, firstItem.id, { minRange: 1 });
    restoreClock();
    await addPulledTemplates(db, [ACCOUNT_MEN, ACCOUNT_WOMEN]);

    await reconcileStarterTemplates(db);

    expect(await templateNamed(db, "Women's")).toBeDefined();
    expect(await templateNamed(db, "Men's")).toBeUndefined();
  });

  it('re-keys legacy fixed-id rows it keeps, repointing items, sets and the settings default', async () => {
    const db = makeTestDatabase();
    await seedWithLegacyIds(db);
    const legacyIds = legacySeedIds();
    const legacyMens = (await templateNamed(db, "Men's"))!;
    const client = await createClient(db, { name: 'Amara Okafor' });
    const set = await createSetWithMeasurements(db, {
      clientId: client.id,
      templateId: legacyMens.id,
      items: [{ key: 'Neck', position: 0, unit: 'in', value: null }],
    });

    // No account templates: everything is kept, so every legacy row must be re-keyed.
    const result = await reconcileStarterTemplates(db);

    expect(result.rekeyed).toBe(2 + STARTER_ITEM_COUNT);
    const templates = await allTemplates(db);
    const items = await db.get<TemplateItem>(Tables.templateItems).query().fetch();
    expect(templates.some((template) => legacyIds.has(template.id))).toBe(false);
    expect(items.some((item) => legacyIds.has(item.id))).toBe(false);

    const newMens = templates.find((template) => template.name === "Men's")!;
    expect(newMens.syncStatus).toBe('created');
    expect(await templateItems(db, newMens.id)).toHaveLength(
      STARTER_TEMPLATES.find((starter) => starter.name === "Men's")!.items.length,
    );
    const reloadedSet = await db.get<MeasurementSet>(Tables.measurementSets).find(set.id);
    expect(reloadedSet.templateId).toBe(newMens.id);
    expect((await getSettings(db))?.defaultTemplateId).toBe(newMens.id);
  });
});

describe('reconcileDefaultTemplate', () => {
  it('keeps the most recently updated default, demotes the rest, and repoints settings', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const olderDefault = { id: '019f9bba-1f01-701d-89bd-864047dbedd2', name: "Men's 2", isDefault: true, updatedAt: 1_785_024_093_937 };
    await addPulledTemplates(db, [ACCOUNT_MEN, ACCOUNT_WOMEN, olderDefault]);
    await reconcileStarterTemplates(db); // drop the local seed first, as runSync does

    const result = await reconcileDefaultTemplate(db);

    expect(result.demoted).toBe(1);
    const defaults = (await allTemplates(db)).filter((template) => template.isDefault);
    expect(defaults.map((template) => template.id)).toEqual([ACCOUNT_WOMEN.id]);
    expect((await getSettings(db))?.defaultTemplateId).toBe(ACCOUNT_WOMEN.id);
  });
});
