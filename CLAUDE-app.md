# Tailor Measurement App — Mobile

This is the **mobile app** repository. The backend is a **separate repo** (no
monorepo); they communicate over the sync API. The sync client here must conform
to the sync contract below.

Product principle, above everything: match the speed, ease, and accuracy of the
**paper measurement card** this replaces — never slower or fussier than pen and paper.

## Source of truth (read first)
- Product & UX spec: @docs/tailor-measurement-app-spec.md
- Data model (the device SQLite store follows this): @docs/tailor-app-data-model.md
- Sync API contract (the sync client implements against this): @docs/tailor-sync-api-contract.md
- Clickable wireframe reference: `docs/tailor-app-wireframe.html` (open in a browser;
  not imported here).
When a casual prompt conflicts with these docs, the docs win — ask first.

## What this repo owns
- The on-device **SQLite store** + versioned migrations (device side of the data model).
- The **sync client**: push/pull per the sync contract, plus the image upload queue
  (sign → PUT → sync the row).
- The entire **UI**: the screens and flows from the product spec / wireframe.
- Local-only settings (units, text size, app lock, default template).

## What this repo does NOT own (it's in the backend repo)
- Postgres schema, the sync endpoints, auth issuance, the storage bucket.
The device store must follow the same data model, and the sync client must conform
to the sync contract — do not invent fields or endpoints; change the docs first.

## Locked decisions (cross-cutting)
- Offline-first: the app is fully usable with no connection. **Never block a
  measurement session on the network.**
- IDs: UUID v7, generated on the device.
- Soft deletes: `deleted_at` tombstones; never hard-delete on device.
- History: `measurement_values` is append-only; current value cached on
  `measurement_items`. Re-measuring writes a value row **only for items whose value
  changed** — untouched items get no write.
- Conflict handling: last-write-wins per row by `updated_at`; on a push response,
  adopt the server's canonical rows (that's how local rows go `pending → synced`).
- Images: on the filesystem + upload queue; never bytes in a row or in a sync payload.
- Units: store canonical decimal inches; fractions (quarters) are a UI concern only.

## The hero screen — do not let it regress
The measurement-entry screen IS the product. Mirror the paper card:
- a scrollable list of items in template order; tap any row to make it active;
- a docked input fixed in the thumb zone = whole-number pad + ¼ ½ ¾ chips + a **Next**
  button living in the pad's bottom-right cell; entering a value auto-advances to the
  next empty item; an "X of Y filled" indicator; "**+ Add item**" as the last row;
- no note/photo controls on this screen;
- the bottom tabs (Clients · Templates · Settings) never appear while measuring.
Keep values in a tabular/monospaced treatment; one tailor's-tape accent for focus and
primary actions. Stay faithful to the wireframe.

## Current focus (recommended build order)
1. Scaffold + the on-device SQLite store + migrations matching the data-model doc.
2. Repository/CRUD layer + the append-only re-measure/history logic (client side).
3. The UI per the product spec — **measurement-entry screen first** (the hero), then
   Clients, Client detail, Set detail, then Templates + Settings.
4. The sync client (push/pull + image upload queue) against the sync contract.
Build the UI against the local store first; wire sync **last**, so the app works
offline from day one.

## Conventions
- Migrations are immutable once shipped — add new ones, never edit old.
- Tests: the history-write rule, soft delete, decimal↔fraction value formatting, and
  the sync client round-trip against a mock of the contract.
- Use plan mode for multi-file work; show the plan first.
- Ask before destructive operations or any change to a locked decision.

## Stack to confirm before scaffolding
- App framework: React Native (Expo) vs Flutter vs native — pick and say why.
- Local DB + sync engine must **match the sync approach chosen for the backend**:
  self-built sync → a WatermelonDB client against our endpoints; managed → the
  PowerSync / ElectricSQL client. Flutter → drift for the local store.
