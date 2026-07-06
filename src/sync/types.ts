/**
 * Wire types for the sync contract (docs/tailor-sync-api-contract.md). These mirror the
 * change-envelope (§3), the pull/push requests/responses (§5/§6), and the error model
 * (§10). Field names are snake_case to match the contract exactly — and, conveniently,
 * our WatermelonDB column names — so a wire row is essentially a raw row minus the
 * device-local columns (§11).
 */

/** One row as it travels on the wire — a bag of snake_case columns plus `id`. */
export type WireRow = { id: string } & Record<string, unknown>;

/** The seven syncable tables, in dependency order (parents before children) so a single
 * apply pass never references a not-yet-written parent. */
export const SYNC_TABLES = [
  'clients',
  'templates',
  'template_items',
  'measurement_sets',
  'measurement_items',
  'measurement_values',
  'images',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

/** A foreign-key edge from a child table to a parent table. */
export type ParentEdge = { table: SyncTable; fk: string };

/**
 * Parent (FK) edges per child table — the server's referential graph. Drives the push's
 * referential closure (a dirty child pulls its ancestor chain into the push) and the
 * rejected-row cross-check diagnostic. Nullable FKs (e.g. `measurement_sets.template_id`)
 * are simply skipped when null. `_fk` suffix on a rejection reason (`client_id_not_found`)
 * maps back to the edge whose `fk` matches.
 */
export const PARENT_EDGES: Partial<Record<SyncTable, ParentEdge[]>> = {
  template_items: [{ table: 'templates', fk: 'template_id' }],
  measurement_sets: [
    { table: 'clients', fk: 'client_id' },
    { table: 'templates', fk: 'template_id' },
  ],
  measurement_items: [{ table: 'measurement_sets', fk: 'set_id' }],
  measurement_values: [{ table: 'measurement_items', fk: 'item_id' }],
  images: [{ table: 'measurement_sets', fk: 'set_id' }],
};

/** created / updated carry full rows; deleted carries bare id strings (tombstones, §3). */
export type EntityChanges = {
  created: WireRow[];
  updated: WireRow[];
  deleted: string[];
};

/** measurement_values is append-only: it only ever appears in `created` (§3, §7). */
export type ValuesChanges = { created: WireRow[] };

export type ChangeEnvelope = {
  clients: EntityChanges;
  templates: EntityChanges;
  template_items: EntityChanges;
  measurement_sets: EntityChanges;
  measurement_items: EntityChanges;
  measurement_values: ValuesChanges;
  images: EntityChanges;
};

export type PullRequest = { cursor: string | null; limit?: number };

export type PullResponse = {
  changes: ChangeEnvelope;
  cursor: string;
  has_more: boolean;
  server_time: number;
};

export type PushRequest = { cursor: string | null; changes: ChangeEnvelope };

/** A row the server refused (validation, §6). The client keeps it pending and surfaces it. */
export type RejectedRow = { entity: SyncTable; id: string; reason: string };

export type PushResponse = {
  /** Server-canonical version of every id the client pushed; the client adopts these. */
  applied: ChangeEnvelope;
  rejected: RejectedRow[];
  cursor: string;
};

/**
 * Transport-level error carrying the HTTP status so the client can run the §10 matrix
 * (401 refresh, 409 cursor reset, 413 halve, 429/5xx backoff). `retryAfterMs` is parsed
 * from a `Retry-After` header when present (429).
 */
export class SyncHttpError extends Error {
  constructor(
    public readonly status: number,
    message?: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message ?? `sync request failed with ${status}`);
    this.name = 'SyncHttpError';
  }
}

/** Transport boundary — injected so the client orchestration is unit-testable against a
 * mock of the contract (build-plan Phase 4.5). */
export type SyncTransport = {
  pull(req: PullRequest, token: string): Promise<PullResponse>;
  push(req: PushRequest, token: string): Promise<PushResponse>;
};

/** Outcome of a sync run, for the caller (Settings "Sync now" / background trigger). */
export type SyncResult =
  | { ok: true; pushed: number; pulled: number; rejected: RejectedRow[]; syncedAt: number }
  | { ok: false; skipped: 'not-configured' | 'signed-out' | 'already-running' }
  | { ok: false; error: string };
