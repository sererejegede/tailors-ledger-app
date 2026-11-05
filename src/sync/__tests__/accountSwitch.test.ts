// Switching accounts on one device (data model §1c). The real backend stamps every user's
// writes from ONE global sequence, so the mock servers below share a counter: that's what
// made another account's cursor skip this account's older rows.
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
import { ensureSeeded, STARTER_TEMPLATES } from '@/db/seed';
import { Tables } from '@/db/schema';
import { createClient } from '@/repositories/clients';
import { getSettings, updateSettings } from '@/repositories/settings';
import { createSetWithMeasurements } from '@/repositories/sets';
import Client from '@/db/models/Client';
import Template from '@/db/models/Template';
import { runSync, _resetRunningGuard } from '../client';
import { backUpBeforeSignOut, getSyncAccount, pruneRowsNotInAccount } from '../account';
import { applyServerChanges, normalizeEnvelope } from '../mapper';
import { MockContractServer } from './contractMock';
import { accountTemplateRow } from './seedFixtures';

const NOW = 1_725_000_000_000;
const ACCOUNT_1 = { id: 'user-1', email: 'one@example.com' };
const ACCOUNT_2 = { id: 'user-2', email: 'two@example.com' };

const signedInAs = (server: MockContractServer, account: typeof ACCOUNT_1) => ({
  transport: server,
  getToken: async () => `token-${account.id}` as string | null,
  getAccount: async () => account,
  now: () => NOW,
  sleep: async () => {},
  imageDeps: null,
});

function clientRow(name: string, id = uuidv7()) {
  return { id, name, phone: null, comment: null, photo_remote_url: null, created_at: NOW, updated_at: NOW, deleted_at: null };
}

async function liveClientNames(db: Database): Promise<string[]> {
  const rows = await db.get<Client>(Tables.clients).query(Q.where('deleted_at', null)).fetch();
  return rows.map((c) => c.name).sort();
}

async function liveTemplateNames(db: Database): Promise<string[]> {
  const rows = await db.get<Template>(Tables.templates).query(Q.where('deleted_at', null)).fetch();
  return rows.map((t) => t.name).sort();
}

function pushedIds(server: MockContractServer): string[] {
  return server.pushLog.flatMap((req) =>
    Object.values(req.changes).flatMap((e) => [
      ...(e.created ?? []).map((r: { id: string }) => r.id),
      ...((e as { updated?: { id: string }[] }).updated ?? []).map((r) => r.id),
    ]),
  );
}

/** Account 1 already has 17 clients and a template on the server, written long ago (low seq). */
function accountOneServer(sequence: { n: number }) {
  const server = new MockContractServer(sequence);
  server.seed('templates', accountTemplateRow({ id: uuidv7(), name: 'Shop standard', isDefault: true, updatedAt: NOW }));
  for (let i = 1; i <= 17; i++) server.seed('clients', clientRow(`Client ${String(i).padStart(2, '0')}`));
  return server;
}
const ACCOUNT_ONE_NAMES = Array.from({ length: 17 }, (_, i) => `Client ${String(i + 1).padStart(2, '0')}`);

beforeEach(() => _resetRunningGuard());

describe('switching accounts on one device', () => {
  it('shows exactly the new account after sync, and pushes nothing across', async () => {
    const sequence = { n: 0 };
    const one = accountOneServer(sequence);
    const two = new MockContractServer(sequence);

    const device = makeTestDatabase();
    await ensureSeeded(device);
    await updateSettings(device, { shopName: 'Kunle Couture' });

    // Account 2 on this device: its writes take higher seqs than all of account 1's rows.
    expect((await runSync(device, signedInAs(two, ACCOUNT_2))).ok).toBe(true);
    await createClient(device, { name: 'Bisi (account 2)' });
    _resetRunningGuard();
    expect((await runSync(device, signedInAs(two, ACCOUNT_2))).ok).toBe(true);

    // Sign out, sign in to account 1.
    _resetRunningGuard();
    const result = await runSync(device, signedInAs(one, ACCOUNT_1));

    expect(result.ok).toBe(true);
    expect(await liveClientNames(device)).toEqual(ACCOUNT_ONE_NAMES);
    expect(await liveTemplateNames(device)).toEqual(['Shop standard']);
    expect(one.pushLog).toHaveLength(0); // nothing of account 2's went into account 1
    expect(two.liveCount('clients')).toBe(1); // and account 2 keeps its client
    expect((await getSyncAccount(device))?.id).toBe(ACCOUNT_1.id);
    expect((await getSettings(device))?.shopName).toBe('Kunle Couture'); // local settings kept
    expect((await getSettings(device))?.defaultTemplateId).toBeDefined();

    // Back to normal deltas: the next sync pulls nothing and removes nothing.
    _resetRunningGuard();
    const again = await runSync(device, signedInAs(one, ACCOUNT_1));
    expect(again.ok && again.pulled).toBe(0);
    expect(await liveClientNames(device)).toEqual(ACCOUNT_ONE_NAMES);
  });

  it('pauses instead of switching while the other account has changes not backed up', async () => {
    const sequence = { n: 0 };
    const one = accountOneServer(sequence);
    const two = new MockContractServer(sequence);
    const twoPull = jest.spyOn(two, 'pull');

    const device = makeTestDatabase();
    await ensureSeeded(device);
    expect((await runSync(device, signedInAs(one, ACCOUNT_1))).ok).toBe(true);
    await createClient(device, { name: 'Made offline' }); // signed out, not yet pushed

    _resetRunningGuard();
    const blocked = await runSync(device, signedInAs(two, ACCOUNT_2));

    expect(blocked).toEqual({ ok: false, skipped: 'other-account', otherAccount: ACCOUNT_1.email, unsynced: 1 });
    expect(two.pushLog).toHaveLength(0);
    expect(twoPull).not.toHaveBeenCalled();
    expect(await liveClientNames(device)).toEqual([...ACCOUNT_ONE_NAMES, 'Made offline'].sort());

    // Back on account 1 the change is pushed where it belongs; then the switch goes through.
    _resetRunningGuard();
    expect((await runSync(device, signedInAs(one, ACCOUNT_1))).ok).toBe(true);
    expect(one.liveCount('clients')).toBe(18);

    _resetRunningGuard();
    expect((await runSync(device, signedInAs(two, ACCOUNT_2))).ok).toBe(true);
    expect(await liveClientNames(device)).toEqual([]);
    expect(two.pushLog).toHaveLength(0);
    // Account 2 has no templates, so the device re-seeds the starters (pushed next sync).
    expect(await liveTemplateNames(device)).toEqual(STARTER_TEMPLATES.map((t) => t.name).sort());
    _resetRunningGuard();
    expect((await runSync(device, signedInAs(two, ACCOUNT_2))).ok).toBe(true);
    const fromOne = new Set(pushedIds(one));
    expect(pushedIds(two).filter((id) => fromOne.has(id))).toEqual([]);
    expect(two.liveCount('templates')).toBe(STARTER_TEMPLATES.length);
  });

  it('repairs an install from before accounts were recorded (the reported case)', async () => {
    const sequence = { n: 0 };
    const one = accountOneServer(sequence);
    const two = new MockContractServer(sequence);

    // Synced with account 2, then the old build kept account 2's rows and cursor.
    const device = makeTestDatabase();
    await ensureSeeded(device);
    await createClient(device, { name: 'Bisi (account 2)' });
    expect((await runSync(device, signedInAs(two, ACCOUNT_2))).ok).toBe(true);
    await device.localStorage.remove('sync_account'); // no record of whose data it is
    await createClient(device, { name: 'Never pushed' });

    _resetRunningGuard();
    const result = await runSync(device, signedInAs(one, ACCOUNT_1));

    expect(result.ok).toBe(true);
    // All 17 come back; account 2's synced rows go; the un-pushed client is kept and
    // backed up to the signed-in account, as the old build would have done.
    expect(await liveClientNames(device)).toEqual([...ACCOUNT_ONE_NAMES, 'Never pushed'].sort());
    expect(await liveTemplateNames(device)).toEqual(['Shop standard']);
    expect(one.liveCount('clients')).toBe(18);
    expect((await getSyncAccount(device))?.id).toBe(ACCOUNT_1.id);
  });
});

describe('pruneRowsNotInAccount', () => {
  it('removes only synced rows the account lacks, and keeps parents of unsynced rows', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const kept = clientRow('Parent of a pending set');
    const gone = clientRow('Other account');
    const mine = clientRow('This account');
    await applyServerChanges(db, normalizeEnvelope({ clients: { created: [kept, gone, mine], updated: [], deleted: [] } }));
    const template = (await db.get<Template>(Tables.templates).query().fetch())[0];
    await createSetWithMeasurements(db, { clientId: kept.id, templateId: template.id, items: [] });
    await createClient(db, { name: 'Pending client' });

    const seen = new Map([['clients' as const, new Set([mine.id])]]);
    await pruneRowsNotInAccount(db, seen);

    expect(await liveClientNames(db)).toEqual(['Parent of a pending set', 'Pending client', 'This account']);
  });
});

describe('backUpBeforeSignOut', () => {
  it('pushes un-synced changes to the account still signed in, so the switch goes through', async () => {
    const sequence = { n: 0 };
    const one = accountOneServer(sequence);
    const two = new MockContractServer(sequence);
    const device = makeTestDatabase();
    await ensureSeeded(device);
    expect((await runSync(device, signedInAs(one, ACCOUNT_1))).ok).toBe(true);
    await createClient(device, { name: 'Made today' });

    _resetRunningGuard();
    const sync = jest.fn(() => runSync(device, signedInAs(one, ACCOUNT_1)));
    const backup = await backUpBeforeSignOut(device, sync);

    expect(backup).toEqual({ unsynced: 0, error: null });
    expect(one.liveCount('clients')).toBe(18);

    // Signed out, then in to account 2: no pause, just account 2's data.
    _resetRunningGuard();
    expect((await runSync(device, signedInAs(two, ACCOUNT_2))).ok).toBe(true);
    expect(await liveClientNames(device)).toEqual([]);
    expect(two.pushLog).toHaveLength(0);
  });

  it('skips the sync when nothing needs backing up', async () => {
    const device = makeTestDatabase();
    await ensureSeeded(device);
    expect((await runSync(device, signedInAs(new MockContractServer(), ACCOUNT_1))).ok).toBe(true);

    const sync = jest.fn();
    expect(await backUpBeforeSignOut(device, sync)).toEqual({ unsynced: 0, error: null });
    expect(sync).not.toHaveBeenCalled();
  });

  it('reports what is still not backed up when the sync fails', async () => {
    const server = new MockContractServer();
    const device = makeTestDatabase();
    await ensureSeeded(device);
    expect((await runSync(device, signedInAs(server, ACCOUNT_1))).ok).toBe(true);
    await createClient(device, { name: 'Made offline' });

    _resetRunningGuard();
    const offline = {
      ...signedInAs(server, ACCOUNT_1),
      transport: {
        pull: server.pull.bind(server),
        push: async () => {
          throw new Error('Network request failed');
        },
      },
    };
    const backup = await backUpBeforeSignOut(device, () => runSync(device, offline));

    expect(backup).toEqual({ unsynced: 1, error: 'Network request failed' });
    expect(await liveClientNames(device)).toContain('Made offline');
  });
});
