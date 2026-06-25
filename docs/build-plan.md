# Tailor Measurement App (mobile) — build plan

## Context

Greenfield mobile repo. Only `CLAUDE-app.md` + the four source-of-truth docs exist
(`docs/tailor-measurement-app-spec.md`, `tailor-app-data-model.md`,
`tailor-sync-api-contract.md`, `tailor-app-wireframe.html`). The backend is a
separate repo; this repo owns the on-device SQLite store, the sync client, the UI,
and local settings — and must **conform** to the data model + sync contract, never
invent fields/endpoints (change docs first).

Product principle above all: the measurement-entry screen must match the speed,
ease, and accuracy of the paper card. Build the UI against the local store first;
wire sync **last**, so the app works offline from day one.

## Confirmed decisions (your sign-off)

- **Framework:** React Native (Expo).
- **Local DB + sync engine:** **WatermelonDB** client against our own `/v1/sync`
  endpoints (self-built sync). The sync contract applies **as-is**.

## Tech stack & key libraries

- **Expo (dev build) + TypeScript.** WatermelonDB has native modules → **not Expo
  Go**; we use `expo prebuild` + a custom dev client. Flag this early.
- **@nozbe/watermelondb** — reactive SQLite, models, migrations, built-in dirty-row
  tracking (so we do **not** need the optional `sync_outbox` table).
- **uuidv7** — device IDs; wired into WatermelonDB via `setGenerator` so every PK is
  UUID v7 (data-model rule), not WatermelonDB's default random id.
- **@react-navigation/native** — bottom tabs (Clients · Templates · Settings) +
  a native-stack that presents Measurement entry / detail / editors **outside** the
  tab bar (hero rule: tabs never show while measuring).
- **expo-image-picker / expo-camera / expo-file-system** — image capture + local
  files for the upload queue.
- **@react-native-community/netinfo** — connectivity trigger for background sync.
- **expo-font** (Plus Jakarta Sans body + Vollkorn titles), **expo-secure-store**
  (auth token / app-lock), **expo-local-authentication** (app lock).
- **Jest + @testing-library/react-native**; WatermelonDB LokiJS/better-sqlite
  adapter for node-side DB tests.

## Repo / folder structure

```
src/
  db/        schema.ts · migrations.ts · models/ · seed.ts · index.ts (Database)
  lib/       ids.ts (uuidv7) · units.ts (decimal↔fraction) · validation.ts (ranges) · time.ts
  repositories/  clients · templates · sets · items (history rule) · images · settings
  sync/      client.ts (pull/push) · cursor.ts · mapper.ts (wire↔model, field filtering) · images.ts (sign→PUT→sync)
  features/  measurement-entry/ (hero) · clients/ · client-detail/ · set-detail/ · item-history/ · templates/ · settings/
  components/  shared UI (Dock, NumberPad, FracChips, MRow, …)
  theme/     tokens.ts (colors/fonts from wireframe) · typography.ts
App.tsx, navigation/
```

---

## Phase 1 — Scaffold + on-device SQLite store + migrations

Matches data-model doc §3 exactly.

1. Scaffold Expo+TS app, ESLint/Prettier, Jest; `expo prebuild`; babel decorators
   plugin for WatermelonDB; JSI SQLite adapter.
   - **Right after scaffold, before any more code: `git init` + first commit** (the
     repo is not currently under git).
2. **Schema** (`db/schema.ts`), tables 1:1 with data model: `clients`, `templates`,
   `template_items`, `measurement_sets`, `measurement_items`, `measurement_values`
   (append-only — **no** `updated_at`/`deleted_at`), `images`, `app_settings`.
   Indexes per data-model §7 (`clients.name`/`phone`, `measurement_sets(client_id,
   deleted_at)`, `measurement_items(set_id, position)`,
   `measurement_values(item_id, recorded_at)`, `images(set_id)` /
   `images(upload_status)`).
3. **Models** (`db/models/`) with associations + decorators; canonical decimal
   inches for values; epoch-ms timestamps.
4. **Bookkeeping mapping (note):** rely on WatermelonDB's built-in `_status` /
   `_changed` for local dirty-tracking rather than a redundant `sync_status` column
   (the contract §11 says `sync_status` never crosses the wire). `created_at` /
   `updated_at` / `deleted_at` are real columns we own (drive LWW + tombstones).
5. **Migrations** (`db/migrations.ts`) with `schemaVersion = 1`; immutable once
   shipped (add new, never edit).
6. **Seed** (`db/seed.ts`, idempotent, first-run): Men's (default) + Women's starter
   templates with the **exact item lists + min/max ranges from the wireframe**
   (`TEMPLATES` in `tailor-app-wireframe.html`), plus one `app_settings` row
   (units=in, fractions=quarters, range-warnings on, default_template = Men's).
7. **Tests:** schema boots; migration runs clean; seed is idempotent.

## Phase 2 — Repository layer + append-only re-measure/history

1. Repos per aggregate. Creation flows: client (name-only); set-from-template
   (copy `template_items` → `measurement_items` with `position` + set
   `template_name_snapshot`); **unnamed draft set** + attach-client-after.
2. **The core history rule** — `items` repo `saveMeasurements(setId, edits)`, one DB
   write batch: for each item compare entered value to `current_value`; **iff
   changed** insert exactly one `measurement_values` row `{item_id, value,
   recorded_at, source:'manual'}` **and** update `current_value`/`current_value_at`;
   unchanged items get **no write at all**. Quick-edit single item from set detail
   uses the same path. (Data-model §4 worked example is the spec.)
3. Soft delete helpers (`deleted_at` tombstones; never hard-delete).
4. **`lib/units.ts`** — canonical decimal ↔ inches-and-fraction, mirroring
   wireframe `fmt()` (¼ ½ ¾, 0.02 tolerance, `″` suffix); `eighths` reserved.
5. **`lib/validation.ts`** — soft range warning from `template_items` min/max
   (non-blocking).
6. **Tests (CLAUDE conventions):** history-write rule (only changed items write;
   unchanged untouched + history preserved), soft delete, decimal↔fraction
   formatting round-trip.

## Phase 3 — UI (measurement-entry FIRST), faithful to the wireframe

`theme/tokens.ts` defines the palette/type: **accent `#810B38`**, **body background
`#FAF9F6`**, **text `#444748`**, **Plus Jakarta Sans** (body) + **Vollkorn** (titles),
tabular mono for values. We take **layout and interaction** from the wireframe but
**override its palette/fonts** with these tokens (this is the higher-fidelity
direction). Components stay presentational so the not-yet-final design can swap in.

**1. Measurement entry (the one the product lives or dies on) — built first.**
Mirrors `#entry` in the wireframe:
- scrollable item list in template order; tap any row to make it active (left accent
  bar + tint); `current_value` shown per row, tabular mono.
- **docked input** in the thumb zone: display (key + big value), **3-chip fraction
  grid `¼ ½ ¾`** (no clear chip — clear by re-tapping the active chip or via the
  delete key), number pad `1–9 / ⌫ / 0 / Next` with **Next in the bottom-right cell**.
- enter value → optional fraction → Next → **auto-advance to next empty** (wrapping,
  per wireframe `commitNext`); **"X of Y filled"** indicator; **"+ Add item"** as the
  last row; ad-hoc item add with "push back to template" option.
- **no note/photo controls here**; measure-first → attach client by name on save;
  unnamed draft until named; autosave/draft; save-incomplete confirm.
- re-measure opens prefilled; items edited this session carry a "changed" marker.
- bottom tabs hidden on this screen (separate stack).
- Reactive: backed by WatermelonDB observables on the local store. **No sync yet.**

**2. Then, in order:** Clients (search-first list, New-measurement FAB) → Client
detail (info + client comment + sets list, New-set) → Set detail (items + current
values, inline per-item history toggle, set note edit/empty states, images
add/remove, Re-measure) → Item history timeline → Templates list + Template editor
(drag-reorder, default toggle, range edit, delete) → New client → Settings (Units,
Fraction steps, Default template, range warnings, app lock, text size; Voice +
Account shown but inert in v1).

## Phase 4 — Sync client (LAST): push/pull + image upload queue

Implements `tailor-sync-api-contract.md` against the local store.

1. **Auth** — Bearer token in secure-store; refresh + retry on `401`.
2. **Sync engine** — drive WatermelonDB's `synchronize()` with custom
   `pullChanges`/`pushChanges` mapping to `POST /v1/sync/pull` and `/v1/sync/push`.
   Opaque **cursor** persisted locally (side-channel kv), replayed each call;
   **push-before-pull** (contract §12); `has_more` paging; apply `applied` rows
   (flip to synced) + handle `rejected` (keep pending, surface); error matrix
   (`401/409/413/422/429/5xx`) per §10. `mapper.ts` strips local-only fields
   (`*_local_uri`, `sync_status`, `upload_status`) per §11; `measurement_values`
   only ever in `created`.
3. **Image upload queue** (`sync/images.ts`) — runs **before** push (§12 step 2):
   `POST /v1/uploads/sign` → `PUT` bytes to bucket → set `upload_status=uploaded` +
   `remote_url` → row syncs next push; retry/backoff; `GET /v1/uploads/url` for read
   URLs. Never block a session; never put bytes in a row.
4. **Trigger** — NetInfo connectivity + foreground; background-safe.
5. **Tests:** round-trip against a **mock of the contract** — pull applies; push
   adopts `applied` + marks synced; `rejected` stays pending; append-only values
   union by id; image sign→PUT→row-sync.

---

## Open items before Phase 4 — RESOLVED (2026-06-25)

1. **Delete tombstones → LWW with a server-stamped delete time.** Deletes stay **bare ids**
   on the wire (contract §3 unchanged); since a bare id has no `updated_at`, the server stamps
   the tombstone at receive-time and LWW resolves delete-vs-edit by that. Doc'd in
   **sync-contract §9** + **data-model §6**. (Rejected: sending `deleted_at` on the wire —
   true edit-time delete LWW — as unnecessary for the single-user model.)
2. **Cursor → our opaque `server_seq` cursor in a side-channel.** Persist it in
   `app_settings.sync_cursor` (+ `last_synced_at`); drive `synchronize()` with custom
   `pullChanges`/`pushChanges`; WatermelonDB is used only for dirty-row tracking + first-vs-delta.
   WatermelonDB's numeric `lastPulledAt` is **not** the checkpoint (wall-clock vs our seq).
   Doc'd in **sync-contract §4** + **data-model §6**.
3. **No `sync_status` column.** Already the case in `db/schema.ts` — dirty-tracking is
   WatermelonDB's built-in `_status`/`_changed` (never crosses the wire). Doc reconciled in
   **data-model §1/§6** + **sync-contract §11**.

All three are now reflected in the source-of-truth docs; Phase 4 can implement against them.

## Verification

- **Per phase:** `npx jest` for the phase's unit tests (schema/seed, history rule +
  formatting, sync round-trip vs mock).
- **Phases 1–3 end-to-end (offline):** run the dev build (`npx expo run:ios` /
  `run:android`), measure a client cold with no network — create client by name,
  fill items via the dock, save, re-measure one item, confirm only that item gets a
  new history row (inspect DB) and the rest are untouched. The whole flow must work
  airplane-mode.
- **Phase 4:** point the sync client at a mock contract server (or the backend if
  ready); verify push/pull cursor round-trip, `applied`/`rejected` handling, and the
  image sign→PUT→sync queue; confirm no sync call ever blocks the measure flow.

## Build sequence & approval gates

Phase 1 → 2 → 3 (measurement-entry screen first, then the rest) → 4. UI built on the
local store throughout; sync wired only in Phase 4.

**Pause gate:** after finishing **each** phase I stop, report what was done + how it
was verified, and **wait for your OK** before starting the next phase. (And `git init`
+ first commit happens right after the initial scaffold, before any further code.)
