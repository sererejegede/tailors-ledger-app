// Keep the sync client off the real backend + Supabase in tests: the transport is injected
// (the mock contract server) and the token is injected, but the modules are imported at the
// top of client.ts, so we still stub them.
jest.mock('@/lib/config', () => ({
  config: { backendBaseUrl: 'http://mock.test/v1', supabaseUrl: '', supabaseAnonKey: '' },
  isBackendConfigured: true,
  isSupabaseConfigured: false,
}));
jest.mock('@/auth/supabase', () => ({ getAccessToken: jest.fn(async () => 'mock-token') }));

import { Database } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { Tables } from '@/db/schema';
import { createClient } from '@/repositories/clients';
import { updateSettings } from '@/repositories/settings';
import { templateItems } from '@/repositories/templates';
import { createSetWithMeasurements, setItems } from '@/repositories/sets';
import { saveMeasurements } from '@/repositories/items';
import Client from '@/db/models/Client';
import Template from '@/db/models/Template';
import { runSync, _resetRunningGuard } from '../client';
import { getCursor, getLastSyncedAt } from '../cursor';
import { collectLocalChanges } from '../mapper';
import { MockContractServer } from './contractMock';

const NOW = 1_725_000_000_000;
const deps = (server: MockContractServer) => ({
  transport: server,
  getToken: async () => 'mock-token' as string | null,
  now: () => NOW,
  sleep: async () => {},
  imageDeps: null, // Stage C is exercised in images.test.ts; skip the upload pass here.
});

async function defaultTemplate(db: Database): Promise<Template> {
  const templates = await db.get<Template>(Tables.templates).query().fetch();
  return templates.find((t) => t.isDefault)!;
}

/** Seed a client with a fully-measured set (so values/items/sets all need to sync). */
async function makeMeasuredClient(db: Database, name = 'Tunde Bello') {
  const client = await createClient(db, { name });
  const template = await defaultTemplate(db);
  const tItems = await templateItems(db, template.id);
  const set = await createSetWithMeasurements(db, {
    clientId: client.id,
    templateId: template.id,
    label: 'Wedding agbada',
    items: tItems.map((t) => ({ key: t.key, position: t.position, unit: t.unit, value: null })),
  });
  const items = await setItems(db, set.id);
  await saveMeasurements(
    db,
    set.id,
    items.map((it, i) => ({ itemId: it.id, value: 20 + i * 0.5 })),
  );
  return { client, set };
}

beforeEach(() => _resetRunningGuard());

describe('runSync — push/pull round-trip against the contract mock', () => {
  it('pushes local rows, adopts applied, marks synced, stores cursor + last-synced', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const { client } = await makeMeasuredClient(db);
    const server = new MockContractServer();

    const before = await collectLocalChanges(db);
    expect(before.count).toBeGreaterThan(0);

    const result = await runSync(db, deps(server));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pushed).toBe(before.count);
      expect(result.rejected).toHaveLength(0);
      expect(result.syncedAt).toBe(NOW);
    }

    // The client row reached the server and is no longer dirty locally.
    expect(server.liveCount('clients')).toBe(1);
    const localClient = await db.get<Client>(Tables.clients).find(client.id);
    expect(localClient.syncStatus).toBe('synced');

    // Nothing is left to push.
    const after = await collectLocalChanges(db);
    expect(after.count).toBe(0);

    expect(await getCursor(db)).toBeTruthy();
    expect(await getLastSyncedAt(db)).toBe(NOW);
  });

  it('keeps a rejected row pending and surfaces it', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    // A blank-named client is invalid server-side (name_required, §6).
    const blank = await createClient(db, { name: '' });
    const server = new MockContractServer();

    const result = await runSync(db, deps(server));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rejected.some((r) => r.id === blank.id && r.entity === 'clients')).toBe(true);
    }

    // The rejected client stays dirty and is re-collected next cycle; the server never stored it.
    const after = await collectLocalChanges(db);
    expect(after.envelope.clients.created.some((r) => r.id === blank.id)).toBe(true);
    expect(server.liveCount('clients')).toBe(0);
  });

  it('unions append-only values by id — a second sync adds no duplicates', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    await makeMeasuredClient(db);
    const server = new MockContractServer();

    await runSync(db, deps(server));
    const valuesAfterFirst = server.liveCount('measurement_values');
    expect(valuesAfterFirst).toBeGreaterThan(0);

    // A no-op second sync (nothing changed locally) must not duplicate value rows.
    const second = await runSync(db, deps(server));
    expect(second.ok).toBe(true);
    expect(server.liveCount('measurement_values')).toBe(valuesAfterFirst);
  });

  it('pulls another device’s rows and writes them locally as synced', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const server = new MockContractServer();

    // Another device already created this client on the server.
    const remoteId = '0190f2a0-0000-7000-8000-0000000000ff';
    server.seed('clients', {
      id: remoteId,
      name: 'Remote Person',
      phone: null,
      comment: null,
      photo_remote_url: null,
      created_at: NOW - 1000,
      updated_at: NOW - 1000,
      deleted_at: null,
    });

    const result = await runSync(db, deps(server));
    expect(result.ok).toBe(true);

    const pulled = await db.get<Client>(Tables.clients).find(remoteId);
    expect(pulled.name).toBe('Remote Person');
    expect(pulled.syncStatus).toBe('synced');
  });

  it('recovers from a 409 by resetting the cursor and re-pulling', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const server = new MockContractServer();

    // Flush the seeded local rows first, so the next sync has nothing to push and the
    // forced 409 lands on the pull (where the contract's cursor-too-old path lives, §10).
    await runSync(db, deps(server));
    _resetRunningGuard();

    // Another device adds a row; meanwhile our stored cursor goes stale/pruned.
    server.seed('clients', {
      id: '0190f2a0-0000-7000-8000-00000000aa01',
      name: 'After Reset',
      phone: null,
      comment: null,
      photo_remote_url: null,
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null,
    });
    await updateSettings(db, { syncCursor: 'seq:999999' });
    server.failNextWith = 409; // first pull rejects the stale cursor

    const result = await runSync(db, deps(server));
    expect(result.ok).toBe(true);
    // The 409 reset the cursor to null and the retry pulled the seeded row.
    const pulled = await db
      .get<Client>(Tables.clients)
      .find('0190f2a0-0000-7000-8000-00000000aa01');
    expect(pulled.name).toBe('After Reset');
  });

  it('no-ops when signed out', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const server = new MockContractServer();
    const result = await runSync(db, { ...deps(server), getToken: async () => null });
    expect(result).toEqual({ ok: false, skipped: 'signed-out' });
  });
});
