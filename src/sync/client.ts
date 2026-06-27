import { Database } from '@nozbe/watermelondb';
import { isBackendConfigured } from '@/lib/config';
import { getAccessToken } from '@/auth/supabase';
import { nowMs } from '@/lib/time';
import {
  SyncHttpError,
  type PullResponse,
  type PushResponse,
  type RejectedRow,
  type SyncResult,
  type SyncTransport,
} from './types';
import { httpTransport } from './transport';
import { getCursor, resetCursor, setCursor, setLastSyncedAt } from './cursor';
import {
  applyServerChanges,
  collectLocalChanges,
  markDeletesSynced,
  normalizeEnvelope,
} from './mapper';
import { runImageUploads, defaultImageUploadDeps, type ImageUploadDeps } from './images';
import {
  syncLog,
  syncWarn,
  syncError,
  envelopeSummary,
  danglingTemplateRefs,
  rejectionReport,
} from './logger';

/**
 * The hand-rolled sync loop (sync-contract §12). Deliberately NOT WatermelonDB's
 * `synchronize()` — it speaks our `applied`/`rejected` + opaque `server_seq` cursor, which
 * `synchronize()` can't (resolved decision, PROGRESS Stage B). Order is **push-before-pull**
 * so we never overwrite un-pushed local edits with older server state.
 *
 * Never blocks a measurement session: callers fire it from the background trigger / a
 * "Sync now" button and it returns a result rather than throwing. A single in-flight run is
 * enforced by a module guard.
 */

const MAX_PULL_PAGES = 1000; // safety bound on has_more paging
const MAX_ATTEMPTS = 4; // per request, for 429/5xx/network backoff
const BASE_BACKOFF_MS = 500;

export type SyncDeps = {
  transport?: SyncTransport;
  getToken?: () => Promise<string | null>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Image upload boundary (Stage C); when omitted the native deps are used. Pass `null`
   * to skip the upload pass entirely (used by the loop's own unit tests). */
  imageDeps?: ImageUploadDeps | null;
};

let running = false;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Run one transport call with the §10 retry matrix for the transient classes:
 * network(0)/429/5xx → bounded exponential backoff; 401 → refresh token once then retry;
 * 413 → caller-handled (we surface it). 409 is caller-handled (cursor reset). */
async function withRetry<T>(
  fn: (token: string) => Promise<T>,
  token: string,
  refreshToken: () => Promise<string | null>,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  let currentToken = token;
  let refreshed = false;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(currentToken);
    } catch (e) {
      if (!(e instanceof SyncHttpError)) throw e;

      if (e.status === 401 && !refreshed) {
        refreshed = true;
        const next = await refreshToken();
        if (!next) throw e;
        currentToken = next;
        continue;
      }

      const transient = e.status === 0 || e.status === 429 || e.status >= 500;
      if (transient && attempt < MAX_ATTEMPTS - 1) {
        await sleep(e.retryAfterMs ?? BASE_BACKOFF_MS * 2 ** attempt);
        continue;
      }
      throw e;
    }
  }
}

export async function runSync(database: Database, deps: SyncDeps = {}): Promise<SyncResult> {
  const transport = deps.transport ?? httpTransport;
  const getToken = deps.getToken ?? getAccessToken;
  const now = deps.now ?? nowMs;
  const sleep = deps.sleep ?? defaultSleep;

  if (!isBackendConfigured) {
    syncLog('skip — backend not configured');
    return { ok: false, skipped: 'not-configured' };
  }
  if (running) {
    syncLog('skip — already running');
    return { ok: false, skipped: 'already-running' };
  }

  const token = await getToken();
  if (!token) {
    syncLog('skip — signed out (no token)');
    return { ok: false, skipped: 'signed-out' };
  }

  running = true;
  const startedAt = now();
  try {
    let cursor = await getCursor(database);
    let pushed = 0;
    let pulled = 0;
    const rejected: RejectedRow[] = [];
    syncLog('start — cursor:', cursor ?? '(first sync)');

    // ── Image upload queue (before push, §12 step 2) ────────────────────────────────
    // So a freshly-uploaded image row carries its remote_url on the push below. Failures
    // are non-blocking (rows stay `failed`, retried next cycle). `null` skips the pass.
    if (deps.imageDeps !== null) {
      const imgResult = await runImageUploads(database, deps.imageDeps ?? defaultImageUploadDeps);
      if (!imgResult.skipped && (imgResult.uploaded || imgResult.failed)) {
        syncLog('images — uploaded:', imgResult.uploaded, 'failed:', imgResult.failed);
      }
    }

    // ── Push (before pull, §12 step 3) ──────────────────────────────────────────────
    const local = await collectLocalChanges(database);
    if (local.count > 0) {
      syncLog('push →', local.count, 'rows |', envelopeSummary(local.envelope));
      // Client-side referential check: if any template_items reference a templates row not
      // in this push, the client is shipping dangling children. Empty means parents are
      // present → an FK error on the server is its apply-order, not ours.
      const dangling = danglingTemplateRefs(local.envelope);
      if (dangling.length) {
        syncWarn('push — template_items reference templates NOT in this push:', dangling);
      }

      const resp: PushResponse = await withRetry(
        (t) => transport.push({ cursor, changes: local.envelope }, t),
        token,
        getToken,
        sleep,
      );
      // Adopt the server-canonical rows (flips created/updated/values → synced), then mark
      // the pushed tombstones synced. Rejected rows stay pending and are surfaced.
      const applied = normalizeEnvelope(resp.applied);
      await applyServerChanges(database, applied, now());
      await markDeletesSynced(database, local.deletedRecords);
      rejected.push(...(resp.rejected ?? []));
      cursor = resp.cursor;
      await setCursor(database, cursor);
      pushed = local.count - rejected.length;
      syncLog('push ✓ applied |', envelopeSummary(applied), '| rejected:', rejected.length);
      if (rejected.length) {
        // Cross-check each rejected row against what we actually sent (created vs updated
        // vs absent) — pins down whether it's a client closure gap, a server created-then-
        // updated ordering gap, or a pure cascade.
        syncWarn('push rejected — cross-check vs envelope:\n' + rejectionReport(local.envelope, rejected));
      }
    } else {
      syncLog('push — nothing to push');
    }

    // ── Pull (paged on has_more, §5) ────────────────────────────────────────────────
    for (let page = 0; page < MAX_PULL_PAGES; page++) {
      let resp: PullResponse;
      try {
        resp = await withRetry(
          (t) => transport.pull({ cursor, limit: 500 }, t),
          token,
          getToken,
          sleep,
        );
      } catch (e) {
        // 409: our cursor was pruned — drop it and restart the pull from scratch (§10).
        if (e instanceof SyncHttpError && e.status === 409) {
          syncWarn('pull — 409 cursor too old; resetting to first sync');
          await resetCursor(database);
          cursor = null;
          continue;
        }
        throw e;
      }

      const changes = normalizeEnvelope(resp.changes);
      const appliedResult = await applyServerChanges(database, changes, now());
      pulled += appliedResult.upserted + appliedResult.deleted;
      cursor = resp.cursor;
      await setCursor(database, cursor);
      syncLog(`pull ✓ page ${page} |`, envelopeSummary(changes), '| has_more:', resp.has_more);
      if (!resp.has_more) break;
    }

    const syncedAt = now();
    await setLastSyncedAt(database, syncedAt);
    syncLog(`done in ${syncedAt - startedAt}ms — pushed:`, pushed, 'pulled:', pulled, 'rejected:', rejected.length);
    return { ok: true, pushed, pulled, rejected, syncedAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof SyncHttpError) {
      syncError(`failed — HTTP ${e.status}:`, message);
    } else {
      syncError('failed:', message);
    }
    return { ok: false, error: message };
  } finally {
    running = false;
  }
}

/** Test-only: clear the in-flight guard between cases. */
export function _resetRunningGuard(): void {
  running = false;
}
