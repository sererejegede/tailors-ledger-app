import { makeTestDatabase } from '@/db/testDatabase';
import { Tables } from '@/db/schema';
import {
  createTemplate,
  createTemplateWithItems,
  updateTemplate,
  templateItems,
  DuplicateTemplateNameError,
} from '../templates';

describe('template name uniqueness', () => {
  it('rejects a duplicate name (case-insensitive, trimmed)', async () => {
    const db = makeTestDatabase();
    await createTemplate(db, { name: 'Agbada' });

    await expect(createTemplate(db, { name: 'Agbada' })).rejects.toBeInstanceOf(
      DuplicateTemplateNameError,
    );
    await expect(createTemplate(db, { name: '  agbada  ' })).rejects.toBeInstanceOf(
      DuplicateTemplateNameError,
    );
  });

  it('lets a template keep its own name on update but blocks taking another’s', async () => {
    const db = makeTestDatabase();
    const a = await createTemplate(db, { name: "Men's" });
    await createTemplate(db, { name: "Women's" });

    await expect(updateTemplate(db, a.id, { name: "Men's" })).resolves.toBeDefined(); // self ok
    await expect(updateTemplate(db, a.id, { name: "Women's" })).rejects.toBeInstanceOf(
      DuplicateTemplateNameError,
    );
  });
});

describe('createTemplateWithItems (lazy create — needs name + items)', () => {
  it('writes the template and its items in order, in one shot', async () => {
    const db = makeTestDatabase();
    const t = await createTemplateWithItems(db, {
      name: 'Cap',
      items: [
        { key: 'Circumference', minRange: 20, maxRange: 26 },
        { key: 'Height' },
      ],
    });

    expect(t.name).toBe('Cap');
    const items = await templateItems(db, t.id);
    expect(items.map((i) => i.key)).toEqual(['Circumference', 'Height']);
    expect(items.map((i) => i.position)).toEqual([0, 1]);
    expect(items[0].minRange).toBe(20);
    expect(items[0].maxRange).toBe(26);
    expect(items[1].minRange == null).toBe(true);
  });

  it('rejects a duplicate name and writes nothing', async () => {
    const db = makeTestDatabase();
    await createTemplate(db, { name: 'Cap' });
    const before = await db.get(Tables.templates).query().fetchCount();

    await expect(
      createTemplateWithItems(db, { name: 'cap', items: [{ key: 'Height' }] }),
    ).rejects.toBeInstanceOf(DuplicateTemplateNameError);

    expect(await db.get(Tables.templates).query().fetchCount()).toBe(before);
  });
});
