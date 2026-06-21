import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import { modelClasses } from './models';
import { installIdGenerator } from '@/lib/ids';

/**
 * Production on-device database. Uses WatermelonDB's JSI SQLite adapter (requires a
 * custom dev build / prebuild — NOT Expo Go). Tests use the in-memory LokiJS database
 * in ./testDatabase instead.
 */
installIdGenerator();

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  dbName: 'tailors_ledger',
  onSetUpError: (error) => {
    // Surface fatal DB setup failures (corrupt store / failed migration).
    // eslint-disable-next-line no-console
    console.error('[db] setup error', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses,
});

export * from './models';
export { Tables, SCHEMA_VERSION } from './schema';
