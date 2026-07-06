import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './schema';
import { migrations } from './migrations';
import { modelClasses } from './models';
import { installIdGenerator } from '@/lib/ids';

/**
 * Web (PWA) on-device database. Metro picks this over ./index.ts on the web platform.
 * WatermelonDB has no SQLite on web — the browser engine is LokiJS backed by IndexedDB.
 * Schema / migrations / models are shared verbatim with the native store; only the adapter
 * differs. SPIKE: proving the web target bundles + runs; revisit useWebWorker for prod.
 */
installIdGenerator();

const adapter = new LokiJSAdapter({
  schema,
  migrations,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  dbName: 'tailors_ledger',
  onSetUpError: (error) => {
    // eslint-disable-next-line no-console
    console.error('[db] web setup error', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses,
});

export * from './models';
export { Tables, SCHEMA_VERSION } from './schema';
