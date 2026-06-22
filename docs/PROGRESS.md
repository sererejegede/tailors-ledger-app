# Build progress & handoff

> Read this first when continuing on another machine. The full approved build plan is
> in [build-plan.md](build-plan.md). Source-of-truth docs: the spec, data-model, and
> sync-contract in this folder; `CLAUDE-app.md` at the repo root.

_Last updated: 2026-06-22._

## Confirmed decisions
- **Framework:** React Native (Expo, SDK 56 / RN 0.85 / React 19 / TypeScript).
- **Local DB + sync engine:** WatermelonDB client against our own `/v1/sync` endpoints
  (self-built sync). The sync contract applies as-is.
- **Build/run target:** Android (physical phone). iOS deferred (needs a Mac).
- **Phased delivery:** finish a phase, verify, **pause for approval**, then next.

## Status by phase
- **Phase 1 — DONE & merged (PR #1).** On-device WatermelonDB store, models, migrations,
  idempotent seed (Men's default + Women's starter templates from the wireframe), test DB.
- **Phase 2 — DONE & merged (PR #2).** Repository layer (`src/repositories/`: clients,
  templates, sets, items, images, settings + shared softDelete), the append-only
  re-measure/history rule (`items.saveMeasurements` — only changed items write), client
  name uniqueness (case-insensitive, blank drafts exempt), `lib/units` (decimal↔fraction)
  + `lib/validation` (soft ranges). Draft sets use a blank-named placeholder client
  (client_id is a required, immutable FK), named on save via `attachClient`.
- **Phase 3 — IN PROGRESS.**
  - **3a — DONE (on `feat/phase-3-measurement-ui`).** Navigation shell (bottom tabs
    Clients · Templates · Settings + a native-stack presenting the hero OUTSIDE the tabs),
    `theme/` tokens + fonts (Plus Jakarta Sans / Vollkorn), `App.tsx` shell (replaces the
    smoke screen), and the **measurement-entry hero** (`features/measurement-entry/` +
    `components/` Dock · NumberPad · FracChips · MeasurementRow · PromptModal) wired to the
    Phase-2 repos. Minimal Clients home launches it; Templates/Settings are stubs.
    Verified on device.
  - **3b — NOT STARTED.** Clients (full) · Client detail · New client · Set detail · Item
    history · Templates list/editor · Settings. (Note: tapping a client currently starts a
    new measurement; the Client-detail screen that lists their saved sets is 3b.)
- **Phase 4 — NOT STARTED.** Sync client (push/pull + image upload queue) vs the
  contract. Open items to resolve first are listed in build-plan.md.

Tests/typecheck (latest): `npm test` → 8 suites / 36 tests pass; `npm run typecheck` clean.

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
5. The app opens to the **Clients screen** (Phase 3a navigation). From there: **New
   measurement** → the measurement-entry hero. (Through Phase 2 the app opened to a
   temporary DB smoke screen; that was replaced by real navigation in Phase 3a.)
   For JS changes you don't rebuild — keep Metro running and reload; only native dep
   changes or `babel.config.js` edits need a rebuild / `expo start -c`.

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

## ✅ Babel / class-properties — RESOLVED (the trilemma)
WatermelonDB models use legacy decorators that need the **class-properties transform to
run** so the decorated field initializer is consumed — otherwise the app throws
*"Decorating class property failed"* at runtime (on Hermes, babel-preset-expo SKIPS that
transform for those files). But forcing class-properties **globally** breaks other libs:
- `loose: true` → a dependency throws *"Cannot assign to read-only property 'NONE'"*.
- `loose: false` → react-navigation throws *"property is not configurable"* (its docs say:
  don't add Babel plugins that change Metro's default class-properties compilation).

**Fix (in `babel.config.js`): scope the forced transform to WatermelonDB code only** via a
Babel `overrides` block applying `class-properties`/`private-methods`/
`private-property-in-object` at `loose: false` **only** to `src/db/models/**` and
`node_modules/@nozbe/watermelondb/**`. Everything else keeps Metro's defaults.
- **The override `test` MUST be a function, not a RegExp.** Expo's Metro transformer loads
  the config WITHOUT a filename to compute a cache key, and Babel throws on a string/RegExp
  `test` with no filename — which manifests as the cryptic *"Cannot read properties of
  undefined (reading 'transformFile')"* (the transformer fails to construct). A function
  test is called safely (returns false at cache-key time).
- The lone root plugin stays `['@babel/plugin-proposal-decorators', { legacy: true }]`.
- Changing `babel.config.js` requires restarting Metro with cache clear: `npx expo start -c`.
- Validate offline without a device: `npx expo export --platform android` must bundle clean.

## Wireless device debugging (no cable)
Wireless adb assigns a **new IP and/or port** each session (DHCP + rotating port), so the
last address goes stale. To reconnect, discover the current one via mDNS rather than
guessing:
```
adb mdns services            # lists the phone with its CURRENT ip:port (the _adb._tcp …:5555 entry)
adb connect <ip>:5555
adb devices                  # confirm "device"
```
With wireless debugging there are often **two transports** for the same phone, so target
adb commands with `-s <ip>:5555` (e.g. `adb -s 192.168.101.6:5555 reverse tcp:8081 tcp:8081`).
If `:5555` refuses, the phone rebooted out of tcpip mode — re-enable once over USB
(`adb tcpip 5555`) or re-pair via One UI → Wireless debugging.

> **Metro dev server:** the user runs `npx expo start` themselves in their own terminal —
> do not launch it from tooling; prompt them when it needs (re)starting.

## Continuing with Claude on the new machine
A fresh Claude session there will auto-load `CLAUDE.md` → `AGENTS.md` +
`CLAUDE-app.md`. Point it at this file and `docs/build-plan.md` to resume. The next
task is **Phase 3b** (the remaining screens — Clients full, Client detail, New client,
Set detail, Item history, Templates editor, Settings) — build against the local store,
keep the per-phase pause gate, and don't touch the sync contract without a doc change.

## Verification commands
- `npm test` — jest (jsdom + WatermelonDB LokiJS in-memory adapter).
- `npm run typecheck` — `tsc --noEmit`.
- `npx expo run:android` — device build + the smoke screen above.
