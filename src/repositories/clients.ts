import { Database, Q } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import Client from '@/db/models/Client';
import { notDeleted, softDeleteById } from './softDelete';

/**
 * Client repository. A client needs nothing but a name to exist; phone/comment/photo
 * are optional and fillable later (spec §3, §6). Name-only creation backs both the
 * "add client" flow and the measure-first "attach a name" flow.
 */

export type NewClient = { name: string; phone?: string; comment?: string };
export type ClientPatch = Partial<{
  name: string;
  phone: string;
  comment: string;
  photoLocalUri: string;
  photoRemoteUrl: string;
}>;

/** Thrown when a non-blank client name collides with an existing (non-deleted) client. */
export class DuplicateClientNameError extends Error {
  constructor(public readonly clientName: string) {
    super(`A client named "${clientName}" already exists.`);
    this.name = 'DuplicateClientNameError';
  }
}

/**
 * Enforce unique client names, case-insensitive and trimmed, among non-deleted clients.
 * Blank names are exempt from the check — a purely defensive guard now: with lazy create
 * (data-model §1a) a client is only written once it has a real name, so the app no longer
 * produces blank-named placeholder drafts. Pass `excludeId` when renaming so a client
 * doesn't clash with itself. Throws `DuplicateClientNameError`.
 *
 * Uniqueness is repo-enforced (WatermelonDB has no unique constraints) and check-then-
 * write is not atomic — fine for the single-user/occasional-multi-device model. Cross-
 * device dupes (two devices coining the same name offline) reconcile at sync, not here.
 */
export async function assertNameAvailable(
  database: Database,
  name: string,
  excludeId?: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return; // blank drafts are exempt
  const target = trimmed.toLowerCase();
  const existing = await database.get<Client>(Tables.clients).query(notDeleted).fetch();
  const clash = existing.some(
    (c) => c.id !== excludeId && c.name.trim().toLowerCase() === target,
  );
  if (clash) throw new DuplicateClientNameError(trimmed);
}

export async function createClient(database: Database, input: NewClient): Promise<Client> {
  const name = input.name.trim();
  await assertNameAvailable(database, name);
  return database.write(() =>
    database.get<Client>(Tables.clients).create((c) => {
      c.name = name;
      if (input.phone != null) c.phone = input.phone;
      if (input.comment != null) c.comment = input.comment;
    }),
  );
}

export async function getClient(database: Database, id: string): Promise<Client> {
  return database.get<Client>(Tables.clients).find(id);
}

export async function updateClient(
  database: Database,
  id: string,
  patch: ClientPatch,
): Promise<Client> {
  const client = await database.get<Client>(Tables.clients).find(id);
  if (patch.name !== undefined) await assertNameAvailable(database, patch.name, id);
  await database.write(async () => {
    await client.update((c) => {
      if (patch.name !== undefined) c.name = patch.name.trim();
      if (patch.phone !== undefined) c.phone = patch.phone;
      if (patch.comment !== undefined) c.comment = patch.comment;
      if (patch.photoLocalUri !== undefined) c.photoLocalUri = patch.photoLocalUri;
      if (patch.photoRemoteUrl !== undefined) c.photoRemoteUrl = patch.photoRemoteUrl;
    });
  });
  return client;
}

export async function softDeleteClient(database: Database, id: string): Promise<void> {
  await softDeleteById<Client>(database, Tables.clients, id);
}

/**
 * Search clients by name or phone (the Clients home is search-first, spec §6). Empty
 * term returns all non-deleted clients. Excludes tombstones.
 */
export async function searchClients(database: Database, term: string): Promise<Client[]> {
  const t = term.trim();
  const collection = database.get<Client>(Tables.clients);
  if (!t) {
    return collection.query(notDeleted, Q.sortBy('name', Q.asc)).fetch();
  }
  const like = `%${Q.sanitizeLikeString(t)}%`;
  return collection
    .query(
      notDeleted,
      Q.or(Q.where('name', Q.like(like)), Q.where('phone', Q.like(like))),
      Q.sortBy('name', Q.asc),
    )
    .fetch();
}
