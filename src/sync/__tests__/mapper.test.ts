import { Database } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { Tables } from '@/db/schema';
import { createClient, updateClient, softDeleteClient } from '@/repositories/clients';
import { templateItems } from '@/repositories/templates';
import { createSetWithMeasurements, setItems } from '@/repositories/sets';
import { saveMeasurements, quickEditItem } from '@/repositories/items';
import Client from '@/db/models/Client';
import Template from '@/db/models/Template';
import {
  collectLocalChanges,
  applyServerChanges,
  markDeletesSynced,
  normalizeEnvelope,
} from '../mapper';
import { _internal } from '../mapper';

async function clientById(db: Database, id: string): Promise<Client> {
  return db.get<Client>(Tables.clients).find(id);
}

async function defaultTemplate(db: Database): Promise<Template> {
  const templates = await db.get<Template>(Tables.templates).query().fetch();
  return templates.find((t) => t.isDefault)!;
}

/** Adopt every currently-dirty row as `synced` (simulates a clean prior sync). */
async function markAllSynced(db: Database): Promise<void> {
  const { envelope } = await collectLocalChanges(db);
  await applyServerChanges(db, envelope);
}

describe('mapper — collectLocalChanges', () => {
  it('partitions dirty rows by status and strips device-local fields', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const client = await createClient(db, { name: 'Tunde Bello', phone: '+234 803 555 0142' });
    // Give the client a device-local photo path that must NOT cross the wire (§11).
    await updateClient(db, client.id, { photoLocalUri: 'file:///local/tunde.jpg' });

    const { envelope, count } = await collectLocalChanges(db);

    expect(count).toBeGreaterThan(0);
    const created = envelope.clients.created;
    const row = created.find((r) => r.id === client.id);
    expect(row).toBeDefined();
    expect(row!.name).toBe('Tunde Bello');
    expect(row!.phone).toBe('+234 803 555 0142');
    // Device-local field is absent from the wire row.
    expect('photo_local_uri' in row!).toBe(false);
    expect(row!).toHaveProperty('photo_remote_url');
  });

  it('maps a soft-deleted row to a bare id in deleted[], never updated[]', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const client = await createClient(db, { name: 'To Delete' });
    // Simulate the row already synced before deletion, so it isn't merely "created".
    await applyServerChanges(db, syncedClientEnvelope(client.id, 'To Delete'));
    await softDeleteClient(db, client.id);

    const { envelope, deletedRecords } = await collectLocalChanges(db);
    expect(envelope.clients.deleted).toContain(client.id);
    expect(envelope.clients.created.some((r) => r.id === client.id)).toBe(false);
    expect(envelope.clients.updated.some((r) => r.id === client.id)).toBe(false);
    expect(deletedRecords.map((d) => d.record.id)).toContain(client.id);
  });

  it('emits measurement_values only in created (append-only)', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const { envelope } = await collectLocalChanges(db);
    // The append-only entity has no updated/deleted arrays at all.
    expect(Array.isArray(envelope.measurement_values.created)).toBe(true);
    expect((envelope.measurement_values as Record<string, unknown>).updated).toBeUndefined();
    expect((envelope.measurement_values as Record<string, unknown>).deleted).toBeUndefined();
  });
});

describe('mapper — referential closure (parents pushed with dirty children)', () => {
  it('re-includes a synced parent template when its items are still dirty', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const template = await defaultTemplate(db);

    // Simulate the corruption: the template got marked synced locally by a prior partial
    // sync, but its template_items are still pending. Without closure the push would ship
    // orphan items → server FK violation.
    await applyServerChanges(db, templateWireEnvelope(template));

    const { envelope } = await collectLocalChanges(db);

    // Items are still pushed…
    const itemsForTemplate = envelope.template_items.created.filter(
      (r) => r.template_id === template.id,
    );
    expect(itemsForTemplate.length).toBeGreaterThan(0);
    // …and the parent is pulled back into the push as `updated` (not created).
    expect(envelope.templates.updated.some((r) => r.id === template.id)).toBe(true);
    expect(envelope.templates.created.some((r) => r.id === template.id)).toBe(false);
  });

  it('closes over the full ancestor chain for a dirty value', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const client = await createClient(db, { name: 'Tunde Bello' });
    const template = await defaultTemplate(db);
    const tItems = await templateItems(db, template.id);
    const set = await createSetWithMeasurements(db, {
      clientId: client.id,
      templateId: template.id,
      items: tItems.map((t) => ({ key: t.key, position: t.position, unit: t.unit, value: null })),
    });
    const items = await setItems(db, set.id);
    await saveMeasurements(db, set.id, [{ itemId: items[0].id, value: 20 }]);

    // Everything synced, then re-measure one item → a fresh value with all-synced ancestors.
    await markAllSynced(db);
    await quickEditItem(db, items[0].id, 21);

    const { envelope } = await collectLocalChanges(db);

    expect(envelope.measurement_values.created).toHaveLength(1);
    expect(envelope.measurement_items.updated.some((r) => r.id === items[0].id)).toBe(true);
    expect(envelope.measurement_sets.updated.some((r) => r.id === set.id)).toBe(true);
    expect(envelope.clients.updated.some((r) => r.id === client.id)).toBe(true);
    expect(envelope.templates.updated.some((r) => r.id === template.id)).toBe(true);
  });
});

describe('mapper — normalizeEnvelope (partial server responses)', () => {
  it('fills missing entity keys so a partial response is safe to apply', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);

    // A server response that only includes the entities it changed (e.g. just clients).
    const partial = {
      clients: { created: [], updated: [], deleted: [] },
    } as never;
    const full = normalizeEnvelope(partial);

    // Every entity exists with the right arrays — no `undefined.created` land mines.
    expect(full.template_items.created).toEqual([]);
    expect(full.measurement_values.created).toEqual([]);
    expect(full.images.deleted).toEqual([]);

    // applyServerChanges tolerates the partial directly (it normalizes / guards too).
    await expect(applyServerChanges(db, full)).resolves.toBeDefined();
  });

  it('returns a fully-empty envelope for undefined', () => {
    const full = normalizeEnvelope(undefined);
    expect(full.clients.created).toEqual([]);
    expect(full.measurement_values.created).toEqual([]);
  });
});

describe('mapper — applyServerChanges', () => {
  it('writes server rows as synced (not dirty) and upserts in place', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);

    // Inbound create.
    const id = '0190f2a0-0000-7000-8000-000000000001';
    await applyServerChanges(db, syncedClientEnvelope(id, 'Server Made'));
    let row = await clientById(db, id);
    expect(row.name).toBe('Server Made');
    expect(row.syncStatus).toBe('synced'); // not re-pushed next cycle

    // Inbound update overwrites the same id, still synced.
    await applyServerChanges(db, syncedClientEnvelope(id, 'Renamed', 'updated'));
    row = await clientById(db, id);
    expect(row.name).toBe('Renamed');
    expect(row.syncStatus).toBe('synced');

    // It is NOT collected as a local change.
    const { envelope } = await collectLocalChanges(db);
    expect(envelope.clients.created.some((r) => r.id === id)).toBe(false);
    expect(envelope.clients.updated.some((r) => r.id === id)).toBe(false);
  });

  it('applies a pulled delete as a synced tombstone', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const id = '0190f2a0-0000-7000-8000-000000000002';
    await applyServerChanges(db, syncedClientEnvelope(id, 'Doomed'));

    await applyServerChanges(db, {
      ..._internal.emptyEnvelope(),
      clients: { created: [], updated: [], deleted: [id] },
    });

    const row = await clientById(db, id);
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(row.syncStatus).toBe('synced');
  });

  it('markDeletesSynced flips pushed tombstones to synced', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const client = await createClient(db, { name: 'Gone' });
    await applyServerChanges(db, syncedClientEnvelope(client.id, 'Gone'));
    await softDeleteClient(db, client.id);

    const { deletedRecords } = await collectLocalChanges(db);
    await markDeletesSynced(db, deletedRecords);

    const again = await collectLocalChanges(db);
    expect(again.envelope.clients.deleted).not.toContain(client.id);
  });
});

/** A minimal envelope carrying one client as a server-canonical row. */
function syncedClientEnvelope(id: string, name: string, slot: 'created' | 'updated' = 'created') {
  const row = {
    id,
    name,
    phone: null,
    comment: null,
    photo_remote_url: null,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
    deleted_at: null,
  };
  const env = _internal.emptyEnvelope();
  env.clients[slot].push(row);
  return env;
}

/** An envelope carrying one template as a server-canonical row (to mark it synced). */
function templateWireEnvelope(t: Template) {
  const env = _internal.emptyEnvelope();
  env.templates.updated.push({
    id: t.id,
    name: t.name,
    is_default: t.isDefault,
    created_at: t.createdAt.getTime(),
    updated_at: t.updatedAt.getTime(),
    deleted_at: null,
  });
  return env;
}
