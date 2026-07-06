/**
 * Sync client (Phase 4) — the hand-rolled push/pull loop + image upload queue against the
 * sync contract (docs/tailor-sync-api-contract.md). Built last, so the app is fully
 * offline-first without it; sync is opt-in (no account → it no-ops).
 */
export { runSync } from './client';
export { getCursor, getLastSyncedAt } from './cursor';
export { httpTransport } from './transport';
export { runImageUploads, getReadUrl, defaultImageUploadDeps } from './images';
export { SyncProvider, useSync } from './SyncProvider';
export type { SyncResult, SyncTransport, RejectedRow } from './types';
