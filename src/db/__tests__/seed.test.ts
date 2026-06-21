import { makeTestDatabase } from '../testDatabase';
import { ensureSeeded, STARTER_TEMPLATES } from '../seed';
import { Tables } from '../schema';
import type Template from '../models/Template';
import type TemplateItem from '../models/TemplateItem';
import type AppSettings from '../models/AppSettings';

describe('ensureSeeded', () => {
  it('seeds the Men\'s (default) + Women\'s starter templates with their items', async () => {
    const db = makeTestDatabase();
    const seeded = await ensureSeeded(db);
    expect(seeded).toBe(true);

    const templates = await db.get<Template>(Tables.templates).query().fetch();
    expect(templates).toHaveLength(2);

    const mens = templates.find((t) => t.name === "Men's")!;
    const womens = templates.find((t) => t.name === "Women's")!;
    expect(mens.isDefault).toBe(true);
    expect(womens.isDefault).toBe(false);

    const mensItems = await db
      .get<TemplateItem>(Tables.templateItems)
      .query()
      .fetch();
    const mensCount = mensItems.filter((i) => i.template.id === mens.id).length;
    const womensCount = mensItems.filter((i) => i.template.id === womens.id).length;
    expect(mensCount).toBe(STARTER_TEMPLATES[0].items.length); // 12
    expect(womensCount).toBe(STARTER_TEMPLATES[1].items.length); // 14

    // items keep template order
    const ordered = mensItems
      .filter((i) => i.template.id === mens.id)
      .sort((a, b) => a.position - b.position)
      .map((i) => i.key);
    expect(ordered).toEqual(STARTER_TEMPLATES[0].items.map((i) => i.key));
  });

  it('creates one settings row pointing default_template_id at the Men\'s template', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);

    const settings = await db.get<AppSettings>(Tables.appSettings).query().fetch();
    expect(settings).toHaveLength(1);
    const mens = (await db.get<Template>(Tables.templates).query().fetch()).find(
      (t) => t.name === "Men's",
    )!;
    expect(settings[0].defaultTemplateId).toBe(mens.id);
    expect(settings[0].units).toBe('in');
    expect(settings[0].fractionGranularity).toBe('quarters');
    expect(settings[0].rangeWarningsEnabled).toBe(true);
  });

  it('is idempotent — a second call is a no-op', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const again = await ensureSeeded(db);
    expect(again).toBe(false);

    expect(await db.get(Tables.templates).query().fetchCount()).toBe(2);
    expect(await db.get(Tables.appSettings).query().fetchCount()).toBe(1);
  });
});
