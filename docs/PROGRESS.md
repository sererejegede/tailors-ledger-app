# Build progress & handoff

> Read this first when continuing on another machine. The full approved build plan is
> in [build-plan.md](build-plan.md). Source-of-truth docs: the spec, data-model, and
> sync-contract in this folder; `CLAUDE-app.md` at the repo root.

_Last updated: 2026-06-21._

## Confirmed decisions
- **Framework:** React Native (Expo, SDK 56 / RN 0.85 / React 19 / TypeScript).
- **Local DB + sync engine:** WatermelonDB client against our own `/v1/sync` endpoints
  (self-built sync). The sync contract applies as-is.
- **Build/run target:** Android (physical phone). iOS deferred (needs a Mac).
- **Phased delivery:** finish a phase, verify, **pause for approval**, then next.

## Status by phase
- **Phase 1 — DONE & committed.** On-device WatermelonDB store, models, migrations,
  idempotent seed (Men's default + Women's starter templates from the wireframe),
  test DB. Tests: `npm test` → 6/6 pass. `npm run typecheck` → clean.
- **Phase 2 — NOT STARTED.** Repository layer + append-only re-measure/history rule
  ("only changed items write"), soft-delete helpers, `lib/units` (decimal↔fraction),
  `lib/validation` (soft ranges), + tests.
- **Phase 3 — NOT STARTED.** UI, measurement-entry screen first, faithful to
  `tailor-app-wireframe.html` for layout/interaction but using the brand tokens
  (accent `#810B38`, bg `#FAF9F6`, text `#444748`, Plus Jakarta Sans body / Vollkorn
  titles). Fraction grid is 3 chips (`¼ ½ ¾`), no clear chip.
- **Phase 4 — NOT STARTED.** Sync client (push/pull + image upload queue) vs the
  contract. Open items to resolve first are listed in build-plan.md.

## How to run on the Android machine
This app uses WatermelonDB (native modules) → **a custom dev build is required; Expo
Go will NOT work.**

1. `git clone <remote>` and `cd` in.
2. `npm install`
3. Connect an Android phone (USB debugging on) or start an emulator.
4. `npx expo run:android` — this runs `expo prebuild` (regenerating `android/`, which
   is gitignored) and builds+installs the dev client. First build is slow.
5. The app opens to a **temporary DB smoke screen** (`App.tsx`) that boots the native
   DB and seeds it. Expected: ✓ booted, 2 templates, 26 template items, 1 settings
   row. That confirms the native DB stack works on device. (This screen is replaced by
   real navigation in Phase 3.)

Requirements on that machine: JDK 17, Android Studio + SDK + platform-tools, an
emulator or a physical device. (Alternatively `eas build --profile development -p
android` for a cloud-built APK.)

## ⚠️ Native build caveat — WatermelonDB on SDK 56 New Architecture
SDK 56 enables the **New Architecture** and the legacy toggle is effectively gone
(`expo-build-properties.android.newArchEnabled:false` did NOT flip `gradle.properties`).
WatermelonDB 0.28 is a legacy-arch native module:
- Its **JSI** path (`jsi: true`) needs the old `getJSIModulePackages()` hook in
  `MainApplication`, which no longer exists under new arch. The community plugin
  `@morrowdigital/watermelondb-expo-plugin` (tested only against SDK 49/50) adds the
  JSI imports but cannot register them on the new-arch template.
- **Current setting: `jsi: false`** in `src/db/index.ts` (bridge mode), which autolinks
  and works through the new-arch interop layer. This is the path to validate first.

**If the device build fails**, in rough order of preference:
1. Confirm bridge mode (`jsi:false`) builds & runs (current default). If it works,
   we're done for v1 — JSI is a perf optimization, not a requirement.
2. If WatermelonDB native won't link at all under new arch, evaluate: a newer
   community plugin/fork with new-arch support, or pin a WatermelonDB version with
   new-arch JSI, or (last resort, and a LOCKED-decision change requiring sign-off)
   switch the local store engine.
3. `expo prebuild -p android` already succeeds at config-generation on Windows — the
   remaining unknowns are gradle compile + runtime, which only the build machine shows.

The `@morrowdigital/watermelondb-expo-plugin` is currently in `app.json` plugins. With
`jsi:false` it isn't strictly needed; if it causes build trouble, removing it and
keeping only `expo-build-properties` (pickFirst `libc++_shared.so`) is a valid
simplification — test both.

## Continuing with Claude on the new machine
A fresh Claude session there will auto-load `CLAUDE.md` → `AGENTS.md` +
`CLAUDE-app.md`. Point it at this file and `docs/build-plan.md` to resume. The next
task is **Phase 2** (repository layer + append-only history) — build against the local
store, keep the per-phase pause gate, and don't touch the sync contract without a doc
change.

## Verification commands
- `npm test` — jest (jsdom + WatermelonDB LokiJS in-memory adapter).
- `npm run typecheck` — `tsc --noEmit`.
- `npx expo run:android` — device build + the smoke screen above.
