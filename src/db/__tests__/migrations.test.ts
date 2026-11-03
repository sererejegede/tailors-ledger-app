import { Database } from '@nozbe/watermelondb';
import { appSchema, tableSchema } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema, Tables } from '../schema';
import { migrations } from '../migrations';
import { ensureSeeded } from '../seed';
import { modelClasses } from '../models';
import type AppSettings from '../models/AppSettings';
import { createClient, searchClients } from '@/repositories/clients';
import { getSettings, updateSettings } from '@/repositories/settings';
import { createJob } from '@/repositories/jobs';

const V2_SETTINGS_COLUMNS = [
  'shop_phone',
  'shop_address',
  'receipt_footer',
  'currency',
  'next_receipt_number',
];
const NEW_TABLES: string[] = [Tables.jobs, Tables.jobItems, Tables.payments];
const V3_SETTINGS_COLUMNS = ['bank_name', 'bank_account_name', 'bank_account_number'];

/** The schema as it shipped at `version`: today's, minus what each later upgrade added. */
function schemaAt(version: 1 | 2) {
  const tablesAdded = version < 2 ? NEW_TABLES : [];
  const columnsAdded = [...(version < 2 ? V2_SETTINGS_COLUMNS : []), ...V3_SETTINGS_COLUMNS];
  return appSchema({
    version,
    tables: Object.values(schema.tables)
      .filter((t) => !tablesAdded.includes(t.name))
      .map((t) =>
        tableSchema({
          name: t.name,
          columns: t.columnArray.filter((c) => !columnsAdded.includes(c.name)),
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
      schema: schemaAt(1),
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

describe('migration to v3', () => {
  it('adds exactly the payment-details columns the v3 schema has', () => {
    const steps = migrations.sortedMigrations.find((m) => m.toVersion === 3)!.steps;
    expect(steps).toHaveLength(1);
    const [step] = steps;
    if (step.type !== 'add_columns') throw new Error(`unexpected step ${step.type}`);
    expect(step.table).toBe(Tables.appSettings);
    const columns = schema.tables[Tables.appSettings].columns;
    expect(step.columns.map((c) => c.name)).toEqual(V3_SETTINGS_COLUMNS);
    for (const c of step.columns) expect(columns[c.name]).toEqual(c);
  });

  it('upgrades an existing v2 store, keeping its shop profile and jobs', async () => {
    const v2Adapter = new LokiJSAdapter({
      schema: schemaAt(2),
      useWebWorker: false,
      useIncrementalIndexedDB: false,
      dbName: `upgrade_${Math.random().toString(36).slice(2)}`,
    });
    const v2 = new Database({ adapter: v2Adapter, modelClasses });
    await ensureSeeded(v2);
    await updateSettings(v2, { shopName: 'Kunle Couture', nextReceiptNumber: 42 });
    const client = await createClient(v2, { name: 'Tunde Bello' });
    const { job } = await createJob(v2, {
      clientId: client.id,
      items: [{ description: 'Agbada', unitPriceMinor: 4500000 }],
      amountMinor: 1000000,
    });

    const v3 = new Database({
      adapter: await v2Adapter.testClone({ schema, migrations }),
      modelClasses,
    });
    const settings = (await getSettings(v3)) as AppSettings;
    expect(settings.shopName).toBe('Kunle Couture');
    expect(settings.nextReceiptNumber).toBe(43); // the job's receipt took 42
    expect(await v3.get(Tables.jobs).find(job.id)).toBeTruthy();

    // The payment details start empty and save, leading zero and all.
    expect(settings.bankAccountNumber ?? null).toBeNull();
    await updateSettings(v3, { bankName: 'GTBank', bankAccountNumber: '0123456789' });
    const saved = (await getSettings(v3)) as AppSettings;
    expect(saved.bankName).toBe('GTBank');
    expect(saved.bankAccountNumber).toBe('0123456789');
  });
});
