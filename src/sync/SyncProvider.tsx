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
import type { RejectedRow } from './types';

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
  /** Manually run a sync now (bypasses the auto-trigger throttle). */
  syncNow: () => void;
};

const SyncContext = createContext<SyncApi>({
  syncing: false,
  lastSyncedAt: null,
  lastError: null,
  rejected: [],
  syncNow: () => {},
});

export const useSync = (): SyncApi => useContext(SyncContext);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<RejectedRow[]>([]);
  const lastRunRef = useRef(0);
  const signedIn = Boolean(session);

  // Show the persisted last-synced time immediately (survives restarts).
  useEffect(() => {
    getLastSyncedAt(database).then((t) => t != null && setLastSyncedAt(t));
  }, []);

  const run = useCallback(
    async (force: boolean) => {
      if (!signedIn) return; // runSync would skip anyway; avoid the churn
      const now = Date.now();
      if (!force && now - lastRunRef.current < AUTO_THROTTLE_MS) return;
      lastRunRef.current = now;

      setSyncing(true);
      setLastError(null);
      const result = await runSync(database);
      setSyncing(false);

      if (result.ok) {
        setLastSyncedAt(result.syncedAt);
        setRejected(result.rejected);
        setLastError(null);
      } else if ('error' in result) {
        setLastError(result.error);
      }
    },
    [signedIn],
  );

  // Sign-in (or app start while already signed in) → an immediate catch-up sync.
  useEffect(() => {
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

  const syncNow = useCallback(() => {
    run(true);
  }, [run]);

  return (
    <SyncContext.Provider value={{ syncing, lastSyncedAt, lastError, rejected, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}
