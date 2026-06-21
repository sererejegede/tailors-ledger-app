import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './schema';
import { migrations } from './migrations';
import { modelClasses } from './models';
import { installIdGenerator } from '@/lib/ids';

/**
 * In-memory WatermelonDB for Node tests (LokiJS adapter, no web worker). This is the
 * engine's own way of testing logic without a native build. Each call is a fresh DB.
 */
export function makeTestDatabase(): Database {
  installIdGenerator();
  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
    dbName: `test_${Math.random().toString(36).slice(2)}`,
  });
  return new Database({ adapter, modelClasses });
}
