// Clean-up of rejected rows that can never sync to this account (data model §1d).
jest.mock('@/lib/config', () => ({
  config: { backendBaseUrl: 'http://mock.test/v1', supabaseUrl: '', supabaseAnonKey: '' },
  isBackendConfigured: true,
  isSupabaseConfigured: false,
}));
jest.mock('@/auth/supabase', () => ({
  getAccessToken: jest.fn(async () => null),
  getSignedInAccount: jest.fn(async () => null),
}));

import { Database, Q } from '@nozbe/watermelondb';
import { uuidv7 } from 'uuidv7';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { Tables } from '@/db/schema';
import { createClient, updateClient } from '@/repositories/clients';
import { createSetWithMeasurements } from '@/repositories/sets';
import Client from '@/db/models/Client';
import Template from '@/db/models/Template';
import { runSync, _resetRunningGuard } from '../client';
import { countUnsynced } from '../account';
import { applyRejectedCleanup, cleanupMessage, planRejectedCleanup } from '../cleanup';
import { applyServerChanges, normalizeEnvelope } from '../mapper';
import { legacySeedIds } from '../seedReconcile';
import type { RejectedRow } from '../types';
import { MockContractServer } from './contractMock';

const NOW = 1_725_000_000_000;

async function newDevice(): Promise<{ db: Database; template: Template }> {
  const db = makeTestDatabase();
  await ensureSeeded(db);
  const template = (await db.get<Template>(Tables.templates).query().fetch()).find((t) => t.isDefault)!;
  return { db, template };
}

/** A set measured on this phone: three items, two with values. */
function measuredSet(db: Database, clientId: string, template: Template, label = 'Wedding agbada') {
  return createSetWithMeasurements(db, {
    clientId,
    templateId: template.id,
    label,
    items: [
      { key: 'Neck', position: 0, value: 16 },
      { key: 'Chest', position: 1, value: 40.5 },
      { key: 'Sleeve', position: 2, value: null },
    ],
  });
}

/** A client already backed up somewhere, as a pulled (synced) row. */
async function syncedClient(db: Database, name: string): Promise<string> {
  const id = uuidv7();
  await applyServerChanges(
    db,
    normalizeEnvelope({
      clients: {
        created: [{ id, name, phone: null, comment: null, photo_remote_url: null, created_at: NOW, updated_at: NOW, deleted_at: null }],
        updated: [],
        deleted: [],
      },
    }),
  );
  return id;
}

async function syncedSet(db: Database, clientId: string, template: Template): Promise<string> {
  const id = uuidv7();
  await applyServerChanges(
    db,
    normalizeEnvelope({
      measurement_sets: {
        created: [{
          id, client_id: clientId, template_id: template.id, template_name_snapshot: template.name,
          label: 'Old set', note: null, created_at: NOW, updated_at: NOW, deleted_at: null,
        }],
        updated: [],
        deleted: [],
      },
    }),
  );
  return id;
}

async function clientNames(db: Database): Promise<string[]> {
  return (await db.get<Client>(Tables.clients).query(Q.where('deleted_at', null)).fetch()).map((c) => c.name).sort();
}

const conflict = (entity: RejectedRow['entity'], id: string): RejectedRow => ({ entity, id, reason: 'id_conflict' });

describe('planRejectedCleanup', () => {
  it('takes another account’s client and everything under it, naming what is lost', async () => {
    const { db, template } = await newDevice();
    const tunde = await createClient(db, { name: 'Tunde Bello' });
    const set = await measuredSet(db, tunde.id, template);
    await createClient(db, { name: 'Ada Obi' }); // unrelated, stays

    // The server holds Tunde under another account; his new set isn't on any account.
    const rejected = [conflict('clients', tunde.id), { entity: 'measurement_sets' as const, id: set.id, reason: 'client_id_not_found' }];
    const plan = (await planRejectedCleanup(db, rejected))!;

    expect(plan.backedUp).toEqual(['Tunde Bello: the client']);
    expect(plan.notBackedUp).toEqual(['Tunde Bello: 1 measurement set, 2 measurements']);
    expect(plan.rows).toHaveLength(1 + 1 + 3 + 2); // client, set, items, values

    const outcome = await applyRejectedCleanup(db, rejected, plan.signature);
    expect(outcome).toEqual({ removed: 7, stale: false });
    expect(await clientNames(db)).toEqual(['Ada Obi']);
    expect(await db.get(Tables.measurementSets).query().fetchCount()).toBe(0);
  });

  it('counts backed-up children as backed up, and local edits as lost', async () => {
    const { db, template } = await newDevice();
    const id = await syncedClient(db, 'Ada Obi');
    await syncedSet(db, id, template);
    await updateClient(db, id, { phone: '+234 803 555 0142' }); // edited here, not backed up

    const plan = (await planRejectedCleanup(db, [conflict('clients', id)]))!;

    expect(plan.backedUp).toEqual(['Ada Obi: the client, 1 measurement set']);
    expect(plan.notBackedUp).toEqual(['Ada Obi: edits to the client']);
  });

  it('removes an orphan only when its parent is missing on this phone', async () => {
    const { db, template } = await newDevice();
    const gone = await createClient(db, { name: 'Removed' });
    const orphan = await measuredSet(db, gone.id, template);
    await db.write(async () => {
      await (await db.get(Tables.clients).find(gone.id)).destroyPermanently();
    });
    const rejected: RejectedRow[] = [{ entity: 'measurement_sets', id: orphan.id, reason: 'client_id_not_found' }];

    const plan = (await planRejectedCleanup(db, rejected))!;
    expect(plan.backedUp).toEqual([]);
    expect(plan.notBackedUp).toEqual(['A client no longer on this phone: 1 measurement set, 2 measurements']);
  });

  it('leaves everything else alone', async () => {
    const { db, template } = await newDevice();
    const blank = await createClient(db, { name: 'Will be blank' });
    const set = await measuredSet(db, blank.id, template);

    // A field rejection, and a missing-parent rejection whose parent IS on the phone.
    const rejected: RejectedRow[] = [
      { entity: 'clients', id: blank.id, reason: 'name_required' },
      { entity: 'measurement_sets', id: set.id, reason: 'client_id_not_found' },
    ];
    expect(await planRejectedCleanup(db, rejected)).toBeNull();
    expect(await planRejectedCleanup(db, [])).toBeNull();
  });

  it('ignores the old fixed-id starters (handled by the seed re-key), and synced rows', async () => {
    const { db } = await newDevice();
    const [legacyId] = [...legacySeedIds()];
    const synced = await syncedClient(db, 'Already synced');
    expect(await planRejectedCleanup(db, [conflict('templates', legacyId), conflict('clients', synced)])).toBeNull();
  });

  it('keeps sets made from another account’s template (a soft link)', async () => {
    const { db, template } = await newDevice();
    const client = await createClient(db, { name: 'Tunde Bello' });
    const set = await measuredSet(db, client.id, template);

    const plan = (await planRejectedCleanup(db, [conflict('templates', template.id)]))!;

    expect(plan.rows.every((r) => r.table === 'templates' || r.table === 'template_items')).toBe(true);
    expect(plan.backedUp).toEqual([`The “${template.name}” template: the template`]);
    await applyRejectedCleanup(db, [conflict('templates', template.id)], plan.signature);
    expect((await db.get(Tables.measurementSets).find(set.id)).id).toBe(set.id);
  });

  it('removes nothing if the rows changed since the confirm was shown', async () => {
    const { db, template } = await newDevice();
    const tunde = await createClient(db, { name: 'Tunde Bello' });
    const rejected = [conflict('clients', tunde.id)];
    const plan = (await planRejectedCleanup(db, rejected))!;

    await measuredSet(db, tunde.id, template); // new work after the confirm opened

    expect(await applyRejectedCleanup(db, rejected, plan.signature)).toEqual({ removed: 0, stale: true });
    expect(await clientNames(db)).toEqual(['Tunde Bello']);
  });
});

describe('cleanupMessage', () => {
  it('lists backed-up data and what will be lost', () => {
    const text = cleanupMessage({
      rows: [],
      backedUp: ['Tunde Bello: the client'],
      notBackedUp: ['Tunde Bello: 1 measurement set, 2 measurements'],
      signature: 'x',
    });
    expect(text).toContain('already backed up there');
    expect(text).toContain('• Tunde Bello: the client');
    expect(text).toContain('It will be lost:\n• Tunde Bello: 1 measurement set, 2 measurements');
    expect(text.endsWith('Remove it from this phone?')).toBe(true);
  });
});

describe('after a sync', () => {
  beforeEach(() => _resetRunningGuard());

  it('clears the stuck rows so the next sync is clean', async () => {
    const { db } = await newDevice();
    const server = new MockContractServer();
    const deps = {
      transport: server,
      getToken: async () => 'tok' as string | null,
      getAccount: async () => ({ id: 'user-1', email: 'one@example.com' }),
      now: () => NOW,
      sleep: async () => {},
      imageDeps: null,
    };
    expect((await runSync(db, deps)).ok).toBe(true);
    const tunde = await createClient(db, { name: 'Tunde Bello' });
    server.foreignIds.add(tunde.id);

    _resetRunningGuard();
    const first = await runSync(db, deps);
    if (!first.ok) throw new Error('sync failed');
    expect(first.rejected).toEqual([conflict('clients', tunde.id)]);

    const plan = (await planRejectedCleanup(db, first.rejected))!;
    await applyRejectedCleanup(db, first.rejected, plan.signature);

    _resetRunningGuard();
    const second = await runSync(db, deps);
    expect(second.ok && second.rejected).toEqual([]);
    expect(await countUnsynced(db)).toBe(0);
  });
});
