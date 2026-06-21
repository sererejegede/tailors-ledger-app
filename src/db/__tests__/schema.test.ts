import { schema, SCHEMA_VERSION, Tables } from '../schema';
import { makeTestDatabase } from '../testDatabase';

describe('schema', () => {
  it('is at version 1 and declares every data-model table', () => {
    expect(schema.version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(1);
    for (const name of Object.values(Tables)) {
      expect(schema.tables[name]).toBeDefined();
    }
  });

  it('keeps measurement_values append-only (no updated_at / deleted_at)', () => {
    const columns = schema.tables[Tables.measurementValues].columns;
    expect(columns.updated_at).toBeUndefined();
    expect(columns.deleted_at).toBeUndefined();
    // but it does keep the immutable bookkeeping it needs
    expect(columns.value).toBeDefined();
    expect(columns.recorded_at).toBeDefined();
    expect(columns.created_at).toBeDefined();
  });

  it('boots an in-memory database that can be queried', async () => {
    const db = makeTestDatabase();
    const count = await db.get(Tables.clients).query().fetchCount();
    expect(count).toBe(0);
  });
});
