import { makeTestDatabase } from '@/db/testDatabase';
import {
  createClient,
  updateClient,
  softDeleteClient,
  DuplicateClientNameError,
} from '../clients';

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
});
