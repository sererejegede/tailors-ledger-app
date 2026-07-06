import {
  SyncHttpError,
  SYNC_TABLES,
  type ChangeEnvelope,
  type EntityChanges,
  type PullRequest,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type RejectedRow,
  type SyncTable,
  type SyncTransport,
  type WireRow,
} from '../types';

/**
 * In-memory reference server implementing the sync contract (docs/tailor-sync-api-contract.md)
 * for round-trip tests. Models the reference implementation in §4: a per-user monotonic
 * `server_seq` stamped on every applied write; the cursor is `seq:<n>`; pull returns rows
 * with `server_seq > cursor` ordered by seq. Conflict resolution is LWW by `updated_at`
 * (§9); `measurement_values` unions by id (§7). Validation rejects a blank client name.
 */

type StoredRow = { row: WireRow; seq: number; table: SyncTable; deleted: boolean };

function emptyEntity(): EntityChanges {
  return { created: [], updated: [], deleted: [] };
}
function emptyEnvelope(): ChangeEnvelope {
  return {
    clients: emptyEntity(),
    templates: emptyEntity(),
    template_items: emptyEntity(),
    measurement_sets: emptyEntity(),
    measurement_items: emptyEntity(),
    measurement_values: { created: [] },
    images: emptyEntity(),
  };
}

const decodeCursor = (cursor: string | null): number => {
  if (!cursor) return 0;
  const n = Number(cursor.replace(/^seq:/, ''));
  return Number.isFinite(n) ? n : 0;
};
const encodeCursor = (seq: number): string => `seq:${seq}`;

export class MockContractServer implements SyncTransport {
  private store = new Map<string, StoredRow>(); // key: `${table}:${id}`
  private seq = 0;
  private now = 1_000_000;
  /** Records each push payload for assertions (e.g. idempotency). */
  public pushLog: PushRequest[] = [];
  /** When set, the next call throws this status once, then clears (to test the §10 matrix). */
  public failNextWith: number | null = null;

  private key(table: SyncTable, id: string) {
    return `${table}:${id}`;
  }

  private maybeFail() {
    if (this.failNextWith != null) {
      const status = this.failNextWith;
      this.failNextWith = null;
      throw new SyncHttpError(status, `mock forced ${status}`);
    }
  }

  /** Seed a server-side row directly (simulates another device's change to be pulled). */
  seed(table: SyncTable, row: WireRow, deleted = false) {
    this.seq += 1;
    this.store.set(this.key(table, row.id), { row, seq: this.seq, table, deleted });
  }

  async push(req: PushRequest, _token: string): Promise<PushResponse> {
    this.maybeFail();
    this.pushLog.push(req);
    const applied = emptyEnvelope();
    const rejected: RejectedRow[] = [];

    for (const table of SYNC_TABLES) {
      const changes = req.changes[table] as Partial<EntityChanges>;

      // created + updated upserts
      for (const incoming of [...(changes.created ?? []), ...(changes.updated ?? [])]) {
        if (table === 'clients' && !String(incoming.name ?? '').trim()) {
          rejected.push({ entity: table, id: incoming.id, reason: 'name_required' });
          continue;
        }
        const k = this.key(table, incoming.id);
        const existing = this.store.get(k);

        // Append-only values: union by id — first write wins, re-pushes are no-ops (§7).
        if (table === 'measurement_values') {
          if (!existing) {
            this.seq += 1;
            this.store.set(k, { row: incoming, seq: this.seq, table, deleted: false });
          }
          (applied.measurement_values.created as WireRow[]).push(this.store.get(k)!.row);
          continue;
        }

        // LWW by updated_at (§9): incoming wins iff >= stored.
        const incomingUpdated = Number(incoming.updated_at ?? 0);
        const storedUpdated = Number(existing?.row.updated_at ?? -1);
        if (!existing || incomingUpdated >= storedUpdated) {
          this.seq += 1;
          this.store.set(k, { row: incoming, seq: this.seq, table, deleted: false });
        }
        (applied[table] as EntityChanges).updated.push(this.store.get(k)!.row);
      }

      // deletes — bare ids, server-stamped tombstone time (§9)
      for (const id of changes.deleted ?? []) {
        const k = this.key(table, id);
        const existing = this.store.get(k);
        if (existing) {
          this.seq += 1;
          this.store.set(k, { ...existing, seq: this.seq, deleted: true });
        }
        (applied[table] as EntityChanges).deleted.push(id);
      }
    }

    // A push does NOT advance the client's *received* high-water-mark — the client sends
    // rows, it doesn't receive any. The cursor it pulls with stays its prior position, so
    // the follow-up pull still returns rows another device wrote before this push (and the
    // client's own just-pushed rows, which re-apply idempotently as synced). Returning the
    // post-push max here would skip lower-seq un-pulled rows.
    return { applied, rejected, cursor: req.cursor ?? encodeCursor(0) };
  }

  async pull(req: PullRequest, _token: string): Promise<PullResponse> {
    this.maybeFail();
    const after = decodeCursor(req.cursor);
    const limit = req.limit ?? 500;

    const fresh = [...this.store.values()]
      .filter((s) => s.seq > after)
      .sort((a, b) => a.seq - b.seq);

    const page = fresh.slice(0, limit);
    const hasMore = fresh.length > page.length;
    const cursorSeq = page.length ? page[page.length - 1].seq : after;

    const changes = emptyEnvelope();
    for (const s of page) {
      if (s.deleted) {
        (changes[s.table] as EntityChanges).deleted.push(s.row.id);
      } else if (s.table === 'measurement_values') {
        changes.measurement_values.created.push(s.row);
      } else {
        (changes[s.table] as EntityChanges).created.push(s.row);
      }
    }

    return { changes, cursor: encodeCursor(cursorSeq), has_more: hasMore, server_time: this.now };
  }

  /** Total non-deleted rows held by the server (for assertions). */
  liveCount(table?: SyncTable): number {
    return [...this.store.values()].filter(
      (s) => !s.deleted && (!table || s.table === table),
    ).length;
  }
}
