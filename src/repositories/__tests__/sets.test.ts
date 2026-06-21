import { Database } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { Tables } from '@/db/schema';
import type Template from '@/db/models/Template';
import { templateItems } from '../templates';
import { createClient } from '../clients';
import { createSetFromTemplate, createDraftSet, attachClient, setItems } from '../sets';

async function defaultTemplate(db: Database): Promise<Template> {
  const templates = await db.get<Template>(Tables.templates).query().fetch();
  return templates.find((t) => t.isDefault)!;
}

describe('createSetFromTemplate', () => {
  it('copies the template items into the set in order and snapshots the template name', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const client = await createClient(db, { name: 'Ada' });
    const template = await defaultTemplate(db);

    const set = await createSetFromTemplate(db, {
      clientId: client.id,
      templateId: template.id,
      label: 'Wedding outfit',
    });

    expect(set.templateNameSnapshot).toBe(template.name);
    expect(set.label).toBe('Wedding outfit');

    const tItems = await templateItems(db, template.id);
    const items = await setItems(db, set.id);
    expect(items.map((i) => i.key)).toEqual(tItems.map((t) => t.key));
    expect(items.map((i) => i.position)).toEqual(tItems.map((t) => t.position));
    // current values start empty
    expect(items.every((i) => i.currentValue == null)).toBe(true);
  });
});

describe('measure-first draft + attachClient', () => {
  it('creates an unnamed draft (placeholder client) then names it on attach', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const template = await defaultTemplate(db);

    const set = await createDraftSet(db, { templateId: template.id });

    // Items are copied even though no client is named yet.
    const items = await setItems(db, set.id);
    expect(items.length).toBeGreaterThan(0);

    // Draft's client exists but is unnamed.
    const draftClient = await set.client.fetch();
    expect(draftClient.name).toBe('');

    // Attaching a name updates that same placeholder client.
    const named = await attachClient(db, set.id, { name: 'Walk-in Customer' });
    expect(named.id).toBe(draftClient.id);
    expect(named.name).toBe('Walk-in Customer');
  });
});
