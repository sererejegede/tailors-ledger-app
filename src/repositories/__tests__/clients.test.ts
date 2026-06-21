import { Database } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { Tables } from '@/db/schema';
import type Template from '@/db/models/Template';
import {
  createClient,
  updateClient,
  softDeleteClient,
  DuplicateClientNameError,
} from '../clients';
import { createDraftSet, attachClient } from '../sets';

async function defaultTemplate(db: Database): Promise<Template> {
  const templates = await db.get<Template>(Tables.templates).query().fetch();
  return templates.find((t) => t.isDefault)!;
}

describe('client name uniqueness', () => {
  it('rejects a duplicate name (case-insensitive, trimmed)', async () => {
    const db = makeTestDatabase();
    await createClient(db, { name: 'Tunde Bello' });

    await expect(createClient(db, { name: 'Tunde Bello' })).rejects.toBeInstanceOf(
      DuplicateClientNameError,
    );
    await expect(createClient(db, { name: '  tunde bello  ' })).rejects.toBeInstanceOf(
      DuplicateClientNameError,
    );
  });

  it('allows distinct names', async () => {
    const db = makeTestDatabase();
    await createClient(db, { name: 'Ada' });
    await expect(createClient(db, { name: 'Ada Two' })).resolves.toBeDefined();
  });

  it('frees a name once the holder is soft-deleted', async () => {
    const db = makeTestDatabase();
    const c = await createClient(db, { name: 'Ada' });
    await softDeleteClient(db, c.id);
    await expect(createClient(db, { name: 'Ada' })).resolves.toBeDefined();
  });

  it('lets a client keep its own name on update but blocks taking another’s', async () => {
    const db = makeTestDatabase();
    const a = await createClient(db, { name: 'Ada' });
    await createClient(db, { name: 'Tunde' });

    await expect(updateClient(db, a.id, { name: 'Ada' })).resolves.toBeDefined(); // self, ok
    await expect(updateClient(db, a.id, { name: 'Tunde' })).rejects.toBeInstanceOf(
      DuplicateClientNameError,
    );
  });

  it('exempts blank names so multiple unnamed drafts can coexist', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const template = await defaultTemplate(db);

    const draft1 = await createDraftSet(db, { templateId: template.id });
    const draft2 = await createDraftSet(db, { templateId: template.id });

    const c1 = await draft1.client.fetch();
    const c2 = await draft2.client.fetch();
    expect(c1.name).toBe('');
    expect(c2.name).toBe('');
    expect(c1.id).not.toBe(c2.id); // two distinct blank-named placeholder clients
  });

  it('enforces uniqueness when naming a draft via attachClient', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const template = await defaultTemplate(db);
    await createClient(db, { name: 'Existing Client' });

    const draft = await createDraftSet(db, { templateId: template.id });
    await expect(
      attachClient(db, draft.id, { name: 'Existing Client' }),
    ).rejects.toBeInstanceOf(DuplicateClientNameError);

    // a free name works
    const named = await attachClient(db, draft.id, { name: 'New Person' });
    expect(named.name).toBe('New Person');
  });
});
