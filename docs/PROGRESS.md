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
- **Phase 4 — IN PROGRESS (`feat/phase-4`).** Stage A (Supabase auth) DONE & device-verified;
  Stages B–D (sync loop · image upload queue · NetInfo trigger) pending.

Tests/typecheck: `npm test` → 10 suites / 46 tests; `npm run typecheck` clean;
`npx expo export --platform android` bundles clean.

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

### Stage B — sync loop (next)
`src/sync/`: `cursor.ts` (opaque cursor in `app_settings.sync_cursor` + `last_synced_at`),
`mapper.ts` (model↔wire envelope, strip local-only fields), dirty-row collection, `client.ts`
(push → adopt `applied` / keep `rejected` pending → pull with `has_more` paging; error matrix
401/409/413/429/5xx). Pure JS, unit-tested against a contract mock. Then C (image sign→PUT→sync)
and D (NetInfo + foreground trigger, "Sync now" + last-synced in Settings).
