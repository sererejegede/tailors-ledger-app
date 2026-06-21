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
2b. Ensure env vars are set (user scope on Windows): `JAVA_HOME` → the JDK 17 dir,
   `ANDROID_HOME`/`ANDROID_SDK_ROOT` → `…/AppData/Local/Android/Sdk`, and add
   `platform-tools` (adb) to PATH. **Open a fresh terminal after setting them** — a
   shell started earlier won't see new env vars.
3. Connect an Android phone (USB debugging on — accept the "Allow USB debugging" prompt
   so `adb devices` shows `device`, not `unauthorized`) or start an emulator.
4. `npx expo run:android` — this runs `expo prebuild` (regenerating `android/`, which
   is gitignored) and builds+installs the dev client. First build is slow.
5. The app opens to a **temporary DB smoke screen** (`App.tsx`) that boots the native
   DB and seeds it. Expected: ✓ booted, 2 templates, 26 template items, 1 settings
   row. That confirms the native DB stack works on device. (This screen is replaced by
   real navigation in Phase 3.)

Requirements on that machine: **JDK 17** (not 21 — SDK 56 / RN 0.85 require 17, and
higher JDKs cause Gradle/AGP friction), Android Studio + SDK 36 + platform-tools, the
**NDK `27.1.12297006`** and **CMake 3.x** (RN 0.85.3 pins that exact NDK), an emulator
or a physical device. (Alternatively `eas build --profile development -p android` for a
cloud-built APK.)

> **Install the NDK via Android Studio's SDK Manager, not Gradle's auto-download.**
> Gradle's first-build NDK fetch (~3.5 GB) is not resumable and, if interrupted, leaves
> a 1 KB stub folder with no `source.properties` — which then fails every build with
> *"No version of NDK matched the requested version."* Fix: delete
> `…/Android/Sdk/ndk/27.1.12297006`, then in Android Studio → SDK Manager → SDK Tools →
> **Show Package Details** → NDK (Side by side) → check `27.1.12297006` (+ CMake) → Apply.

## ✅ Native build — RESOLVED (Windows, bridge mode)
**The Android device build now succeeds** (`android/app/build/outputs/apk/debug/app-debug.apk`,
`./gradlew app:assembleDebug` → BUILD SUCCESSFUL). Verified 2026-06-21 on Windows 11 +
JDK 17 + NDK 27.1.12297006. All ABIs (arm64-v8a, armeabi-v7a, x86, x86_64) compile.

Background — WatermelonDB 0.28 on SDK 56 **New Architecture**: its **JSI** path
(`jsi: true`) needs the old `getJSIModulePackages()` hook in `MainApplication`, which no
longer exists under new arch. The community plugin
`@morrowdigital/watermelondb-expo-plugin` injected two imports
(`WatermelonDBJSIPackage`, `JSIModulePackage`) into `MainApplication.kt`; under RN 0.85
`JSIModulePackage` is gone, so Kotlin compile failed with *"Unresolved reference
'JSIModulePackage'."*

**Resolution applied (durable):**
1. **Removed `@morrowdigital/watermelondb-expo-plugin` from `app.json` plugins** — with
   `jsi: false` (bridge mode, set in `src/db/index.ts`) WatermelonDB's package autolinks
   via the normal `PackageList`, so the JSI plugin/imports are dead weight.
   `expo-build-properties` (pickFirst `libc++_shared.so`, `newArchEnabled:false`) stays.
2. Removed the two dead JSI imports from the generated `MainApplication.kt` so the
   existing `android/` compiles immediately. Note `android/` is gitignored and
   regenerated from `app.json`; a future `expo prebuild --clean` produces a correct
   `MainApplication.kt` (no JSI imports) now that the plugin is gone, so the two fixes
   are consistent.

Bridge mode is sufficient for v1 — JSI is a perf optimization, not a requirement. If we
ever revisit `jsi: true`, that needs proper new-arch JSI registration (a newer
plugin/fork or a pinned WatermelonDB with new-arch JSI); switching the store engine is a
LOCKED-decision change requiring sign-off.

> **Build faster after the first time:** `npx expo run:android` re-runs `expo prebuild`
> but reuses cached native (NDK/CMake) output. To skip prebuild entirely on an existing
> `android/`, build Gradle directly: `cd android && ./gradlew app:assembleDebug`.

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
