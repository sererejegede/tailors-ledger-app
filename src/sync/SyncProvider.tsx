import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { database } from '@/db';
import { useAuth } from '@/auth/AuthProvider';
import { runSync } from './client';
import { getLastSyncedAt } from './cursor';
import { backUpBeforeSignOut } from './account';
import { applyRejectedCleanup, planRejectedCleanup, type CleanupPlan } from './cleanup';
import type { RejectedRow, SyncResult } from './types';

/**
 * Background sync trigger + status (Stage D). Fires `runSync` when there's something that
 * makes a sync worthwhile — sign-in, app foreground, and regained connectivity — and
 * exposes a manual "Sync now" plus the last-synced time / rejected count for Settings.
 *
 * It NEVER blocks the measurement flow: every run is fire-and-forget against the local
 * store, and `runSync` itself no-ops when signed out / unconfigured / already running.
 * Auto-triggers are throttled so a flapping connection can't hammer the backend; the
 * manual button bypasses the throttle.
 */

const AUTO_THROTTLE_MS = 15_000;

type SyncApi = {
  syncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  /** Rows the server rejected on the last push (kept pending locally, surfaced here). */
  rejected: RejectedRow[];
  /** Set when sync is paused because the device holds another account's un-backed-up
   * changes (sign back in to that account to back them up). */
  blockedBy: { otherAccount: string | null; unsynced: number } | null;
  /** Manually run a sync now (bypasses the auto-trigger throttle). */
  syncNow: () => void;
  /** Back up this account's un-synced changes before signing out (a switch starts there).
   * Resolves with what's still not backed up, so the caller can warn first. */
  backUpBeforeSignOut: () => Promise<{
    unsynced: number;
    error: string | null;
    cleanup: CleanupPlan | null;
  }>;
  /** Rejected rows that can never sync to this account (another account's data, or orphans)
   * and can be removed from this phone after a confirm (data model §1d). */
  cleanup: CleanupPlan | null;
  /** Remove the confirmed clean-up from this phone, then sync. */
  removeCleanup: (plan: CleanupPlan) => Promise<{ removed: number; stale: boolean }>;
};

const SyncContext = createContext<SyncApi>({
  syncing: false,
  lastSyncedAt: null,
  lastError: null,
  rejected: [],
  blockedBy: null,
  syncNow: () => {},
  backUpBeforeSignOut: async () => ({ unsynced: 0, error: null, cleanup: null }),
  cleanup: null,
  removeCleanup: async () => ({ removed: 0, stale: true }),
});

export const useSync = (): SyncApi => useContext(SyncContext);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<RejectedRow[]>([]);
  const [blockedBy, setBlockedBy] = useState<SyncApi['blockedBy']>(null);
  const [cleanup, setCleanup] = useState<CleanupPlan | null>(null);
  const cleanupRef = useRef<{ plan: CleanupPlan; rejected: RejectedRow[] } | null>(null);
  const lastRunRef = useRef(0);
  const inFlightRef = useRef<Promise<SyncResult> | null>(null);
  // Keyed on the user, not just "signed in", so switching accounts triggers a sync.
  const userId = session?.user.id ?? null;
  const signedIn = userId != null;

  // Show the persisted last-synced time immediately (survives restarts).
  useEffect(() => {
    getLastSyncedAt(database).then((t) => t != null && setLastSyncedAt(t));
  }, []);

  const run = useCallback(
    async (force: boolean): Promise<SyncResult | null> => {
      if (!signedIn) return null; // runSync would skip anyway; avoid the churn
      const now = Date.now();
      if (!force && now - lastRunRef.current < AUTO_THROTTLE_MS) return null;
      lastRunRef.current = now;

      setSyncing(true);
      setLastError(null);
      const pending = runSync(database);
      inFlightRef.current = pending;
      const result = await pending;
      if (inFlightRef.current === pending) inFlightRef.current = null;
      setSyncing(false);

      if (result.ok) {
        setLastSyncedAt(result.syncedAt);
        setRejected(result.rejected);
        setLastError(null);
        setBlockedBy(null);
        const plan = await planRejectedCleanup(database, result.rejected).catch(() => null);
        cleanupRef.current = plan ? { plan, rejected: result.rejected } : null;
        setCleanup(plan);
      } else if ('error' in result) {
        setLastError(result.error);
      } else if (result.skipped === 'other-account') {
        setBlockedBy({ otherAccount: result.otherAccount, unsynced: result.unsynced });
      }
      return result;
    },
    // userId: a new account gets a new `run`, so the effect below syncs it straight away.
    [signedIn, userId],
  );

  // Sign-in (or app start while already signed in) → an immediate catch-up sync.
  useEffect(() => {
    setBlockedBy(null);
    cleanupRef.current = null;
    setCleanup(null);
    if (signedIn) run(true);
  }, [signedIn, run]);

  // Foreground → opportunistic sync (throttled).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run(false);
    });
    return () => sub.remove();
  }, [run]);

  // Regained connectivity → sync (throttled). NetInfo fires on every change; we only act
  // when actually connected and reachability isn't explicitly false.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) run(false);
    });
    return unsubscribe;
  }, [run]);

  const backUp = useCallback(async () => {
    if (inFlightRef.current) await inFlightRef.current; // let a background run finish first
    const outcome = await backUpBeforeSignOut(
      database,
      async () => (await run(true)) ?? { ok: false, skipped: 'signed-out' },
    );
    return { ...outcome, cleanup: outcome.unsynced > 0 ? (cleanupRef.current?.plan ?? null) : null };
  }, [run]);

  const removeCleanup = useCallback(
    async (plan: CleanupPlan) => {
      const current = cleanupRef.current;
      if (!current || current.plan.signature !== plan.signature) return { removed: 0, stale: true };
      if (inFlightRef.current) await inFlightRef.current;
      const outcome = await applyRejectedCleanup(database, current.rejected, plan.signature);
      cleanupRef.current = null;
      setCleanup(null);
      await run(true); // confirm the rest syncs, and refresh the rejected count
      return outcome;
    },
    [run],
  );

  const syncNow = useCallback(() => {
    run(true);
  }, [run]);

  return (
    <SyncContext.Provider
      value={{
        syncing,
        lastSyncedAt,
        lastError,
        rejected,
        blockedBy,
        syncNow,
        backUpBeforeSignOut: backUp,
        cleanup,
        removeCleanup,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
