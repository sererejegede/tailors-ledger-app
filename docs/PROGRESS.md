# Build progress & handoff

> Read this first when continuing on another machine. Full plan in [build-plan.md](build-plan.md);
> source-of-truth docs: spec, data-model, sync-contract (this folder) + `CLAUDE-app.md` (root).

_Last updated: 2026-06-26._

## Confirmed decisions
- **Framework:** React Native (Expo SDK 56 / RN 0.85 / React 19 / TypeScript).
- **Local DB + sync:** WatermelonDB (bridge mode, `jsi:false`) + self-built sync against our
  `/v1/sync` endpoints; the contract applies as-is.
- **Auth (Phase 4):** Supabase, **opt-in** — the app is fully usable offline with no account.
  Passwordless: Google OAuth + magic-link.
- **Resolved sync decisions** (sync-contract §4/§9/§11 + data-model §6): deletes = LWW with a
  server-stamped tombstone time (bare ids on the wire); opaque `server_seq` cursor stored in
  `app_settings.sync_cursor`; no `sync_status` column (WatermelonDB `_status`/`_changed`).
- **Build/run target:** Android (physical phone). iOS deferred.
- **Phased delivery:** finish a phase, verify, pause for approval, then next.

## Status by phase
- **Phase 1 — DONE.** WatermelonDB store, models, migrations, idempotent seed (Men's/Women's
  starter templates), test DB.
- **Phase 2 — DONE.** Repositories + append-only history rule (`items.saveMeasurements`),
  `lib/units` + `lib/validation`. *(The old blank-placeholder-draft + `attachClient` flow was
  superseded by Phase-3 lazy create and removed.)*
- **Phase 3 — DONE.** All UI screens + lazy create, overlay portal, hero polish, inline
  history, soft range warnings, and four native features (set images, app lock, drag-reorder,
  text size). Device-verified. Compact reference below.
- **Phase 4 — IN PROGRESS (`feat/phase-4-sync`).** Stage A (Supabase auth) DONE &
  device-verified. **Stages B–D built & test-verified** (sync loop · image upload queue ·
  NetInfo/foreground trigger + "Sync now"); **device sync verification pending** (needs the
  live backend at `backendBaseUrl`).

Tests/typecheck: `npm test` → 13 suites / 63 tests (was 10/46; +3 sync suites / 17 tests);
`npm run typecheck` clean; `npx expo export --platform android` bundles clean.

## Phase 4 — sync (in progress)
Staged: **A) Supabase auth ✅ · B) hand-rolled sync loop · C) image upload queue · D) NetInfo +
foreground trigger.** Loop is hand-rolled (not WatermelonDB `synchronize()`) to match the
contract's `applied`/`rejected` + opaque cursor; unit-tested against an in-memory mock; live
backend supplied by the user.

### Stage A — Supabase auth (DONE)
Opt-in via **Settings → Account**; the app works fully signed-out (sync just no-ops).
- **Deps:** `@supabase/supabase-js`, `@react-native-async-storage/async-storage` (session
  storage — Supabase sessions exceed secure-store's 2 KB limit), `react-native-url-polyfill`,
  `@react-native-community/netinfo`, `expo-linking`, `expo-web-browser`, `expo-constants`.
- **Config:** `src/lib/config.ts` reads `app.json` → `expo.extra`: `backendBaseUrl`,
  `supabaseUrl`, `supabaseAnonKey` — **fill these in** (anon key is public/RLS-safe). Auth +
  sync stay inert until filled.
- **Code:** `src/auth/supabase.ts` (client w/ AsyncStorage, autoRefresh, foreground refresh,
  `getAccessToken()` for the sync Bearer); `src/auth/AuthProvider.tsx` (session state; Google
  via `signInWithOAuth` + `expo-web-browser`; magic-link fallback; redirect handler covers
  implicit `#access_token` **and** PKCE `?code`). Wired in `App.tsx`; UI in
  `src/features/settings/AccountSection.tsx`.
- **Deep-link gotchas (hard-won — this is what blocked sign-in):**
  - The `tailorsledger://` scheme (`scheme` in `app.json`) needs **`expo prebuild --clean`** —
    plain `expo run:android` will NOT add a new scheme to an existing `android/` manifest.
    Verify: `adb shell am start -a android.intent.action.VIEW -d "tailorsledger://auth-callback"`
    should launch the app, not error "unable to resolve Intent".
  - Supabase → Authentication → URL Configuration → **Redirect URLs** must list
    `tailorsledger://auth-callback` (else it falls back to the Site URL, e.g. localhost:3000).
  - Google: a **Web** OAuth client (Google Cloud) with redirect URI
    `https://<project-ref>.supabase.co/auth/v1/callback`, pasted into Supabase → Providers →
    Google; add yourself as a consent-screen test user.
  - After any reinstall / wireless-adb reconnect, re-run `adb reverse tcp:8081 tcp:8081` or the
    dev build shows a **blank screen** (can't reach Metro).

### Stages B–D — sync (DONE, test-verified) — `src/sync/`
Hand-rolled loop (not WatermelonDB `synchronize()`) so it speaks the contract's
`applied`/`rejected` + opaque `server_seq` cursor. Files:
- `types.ts` — wire types (change envelope, pull/push, `SyncHttpError`, transport boundary).
- `cursor.ts` — opaque cursor in `app_settings.sync_cursor` (+ `last_synced_at`); `''`→`null`.
- `mapper.ts` — **the core.** `collectLocalChanges` gathers dirty rows via WatermelonDB
  `syncStatus !== 'synced'` (no `sync_status` column). **Key reconciliation:** our soft
  deletes are `deleted_at` tombstones (not WatermelonDB hard-deletes), so a dirty row with
  `deletedAt` set maps to a **bare id in `deleted[]`** (contract §3), never to `updated`.
  `applyServerChanges` writes server-canonical rows as `_status:'synced'` (prepared
  batch + `sanitizedRaw`/`prepareCreateFromDirtyRaw`) so adopted/pulled rows aren't
  re-pushed; pulled deletes become synced tombstones. Strips local-only fields (§11).
  **Referential closure** (`closeOverParents`): every dirty child pulls its whole ancestor
  chain into the push (a synced parent is re-sent as `updated` — idempotent under LWW), so
  the server never applies a child before its parent. Fixes the device FK error
  (`template_items_template_id_fkey`) where a parent template was marked synced locally but
  never landed server-side, leaving orphan items pushed forever; closure self-heals it.
- `logger.ts` — `[sync]`-prefixed console trace (on in `__DEV__`): push/pull envelope
  summaries, raw HTTP status + server body (where the FK error surfaced), `rejected` rows,
  a client-side dangling-parent check. Wired through `client.ts`/`transport.ts`/`images.ts`.
- `transport.ts` — `fetch` to `${backendBaseUrl}/sync/pull|push`; non-2xx → `SyncHttpError`.
- `client.ts` — `runSync`: image-upload pass → **push-before-pull** → adopt `applied` /
  mark tombstones synced / keep `rejected` pending → paged pull. Error matrix §10
  (401 refresh-once · 409 cursor-reset+full-pull · 413/429/5xx/network bounded backoff).
  In-flight guard; never throws (returns a `SyncResult`).
- `images.ts` — upload queue (§8): pending rows → sign → PUT bytes → `uploaded`+`remote_url`
  → syncs next push. **expo-file-system v56 API**: `new File(uri).size` /
  `new File(uri).upload(url, { httpMethod:'PUT', uploadType: UploadType.BINARY_CONTENT })`
  (the legacy `uploadAsync`/`FileSystemUploadType` is gone). Injectable deps for tests.
- `SyncProvider.tsx` — triggers `runSync` on sign-in / foreground (AppState) / regained
  connectivity (NetInfo), throttled 15 s; `useSync()` exposes `syncing`/`lastSyncedAt`/
  `rejected`/`syncNow`. Mounted in `App.tsx` under `AuthProvider`; surfaced in
  `settings/AccountSection.tsx` (last-synced + "Sync now").

Tests (`src/sync/__tests__/`): `contractMock.ts` = in-memory reference server (per-user
`server_seq`, LWW by `updated_at`, values union by id, blank-name reject). Covered: dirty
partition + field-stripping + tombstone→bare-id; apply-as-synced upsert/delete; full
round-trip (push adopts `applied`, marks synced, stores cursor + last-synced); `rejected`
stays pending; values union (no dup on re-sync); pull writes other-device rows; 409 cursor
reset; signed-out no-op; image sign→PUT→uploaded + failure non-blocking.

**Remaining for Phase 4:** point at the live backend and device-verify a real round-trip
(push/pull cursor, image upload, no sync call blocks the measure flow). The push-response
cursor handling assumes a push does **not** advance the client's received high-water-mark
(pull does) — confirm the backend matches, else adjust `client.ts` cursor save after push.
