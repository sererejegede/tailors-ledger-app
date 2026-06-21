import { makeTestDatabase } from '@/db/testDatabase';
import { Tables } from '@/db/schema';
import type Client from '@/db/models/Client';
import { createClient, searchClients, softDeleteClient } from '../clients';

describe('soft delete (tombstones, never hard-delete)', () => {
  it('stamps deleted_at, keeps the row, and excludes it from queries', async () => {
    const db = makeTestDatabase();
    const a = await createClient(db, { name: 'Keep Me' });
    const b = await createClient(db, { name: 'Delete Me' });

    await softDeleteClient(db, b.id);

    // Row still exists (it's a tombstone, not a hard delete).
    const stillThere = await db.get<Client>(Tables.clients).find(b.id);
    expect(stillThere.deletedAt).toBeInstanceOf(Date);

    // Default (non-deleted) queries exclude it.
    const results = await searchClients(db, '');
    const ids = results.map((c) => c.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
  });

  it('search by name excludes tombstoned clients', async () => {
    const db = makeTestDatabase();
    const c = await createClient(db, { name: 'Tunde Bello', phone: '+234 803 555 0142' });
    await softDeleteClient(db, c.id);

    expect(await searchClients(db, 'Tunde')).toHaveLength(0);
    expect(await searchClients(db, '0142')).toHaveLength(0);
  });
});
