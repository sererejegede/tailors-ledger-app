import { Database } from '@nozbe/watermelondb';
import { appSchema, tableSchema } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema, Tables } from '../schema';
import { migrations } from '../migrations';
import { ensureSeeded } from '../seed';
import { modelClasses } from '../models';
import type AppSettings from '../models/AppSettings';
import { createClient, searchClients } from '@/repositories/clients';
import { getSettings } from '@/repositories/settings';
import { createJob } from '@/repositories/jobs';

const NEW_SETTINGS_COLUMNS = [
  'shop_phone',
  'shop_address',
  'receipt_footer',
  'currency',
  'next_receipt_number',
];
const NEW_TABLES: string[] = [Tables.jobs, Tables.jobItems, Tables.payments];

/** The schema as it shipped at v1: today's, minus what v2 added. */
function schemaV1() {
  return appSchema({
    version: 1,
    tables: Object.values(schema.tables)
      .filter((t) => !NEW_TABLES.includes(t.name))
      .map((t) =>
        tableSchema({
          name: t.name,
          columns: t.columnArray.filter((c) => !NEW_SETTINGS_COLUMNS.includes(c.name)),
        }),
      ),
  });
}

describe('migration to v2', () => {
  it('declares exactly the columns the v2 schema has', () => {
    const steps = migrations.sortedMigrations.find((m) => m.toVersion === 2)!.steps;
    for (const step of steps) {
      if (step.type === 'create_table') {
        expect(step.schema.columnArray).toEqual(schema.tables[step.schema.name].columnArray);
      } else if (step.type === 'add_columns') {
        expect(step.table).toBe(Tables.appSettings);
        const columns = schema.tables[Tables.appSettings].columns;
        for (const c of step.columns) expect(columns[c.name]).toEqual(c);
      }
    }
    const created = steps.flatMap((s) => (s.type === 'create_table' ? [s.schema.name] : []));
    expect(created.sort()).toEqual([...NEW_TABLES].sort());
  });

  it('upgrades an existing v1 store without losing data', async () => {
    const v1Adapter = new LokiJSAdapter({
      schema: schemaV1(),
      useWebWorker: false,
      useIncrementalIndexedDB: false,
      dbName: `upgrade_${Math.random().toString(36).slice(2)}`,
    });
    const v1 = new Database({
      adapter: v1Adapter,
      modelClasses: modelClasses.filter((m) => !NEW_TABLES.includes(m.table)),
    });
    await ensureSeeded(v1);
    const before = await createClient(v1, { name: 'Tunde Bello' });

    // Reopen the same store with today's schema, the way an app update does.
    const v2 = new Database({
      adapter: await v1Adapter.testClone({ schema, migrations }),
      modelClasses,
    });
    expect((await searchClients(v2, '')).map((c) => c.id)).toEqual([before.id]);

    // The new settings columns come up empty on the existing row...
    const settings = (await getSettings(v2)) as AppSettings;
    expect(settings.currency ?? null).toBeNull();
    expect(settings.nextReceiptNumber ?? null).toBeNull();

    // ...and the new tables work straight away.
    const { payment } = await createJob(v2, {
      clientId: before.id,
      items: [{ description: 'Agbada', unitPriceMinor: 4500000 }],
      amountMinor: 1000000,
    });
    expect(payment!.receiptNumber).toBe(1);
  });
});
