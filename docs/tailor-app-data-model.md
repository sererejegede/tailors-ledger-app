# Tailor Measurement App — Data Model (Offline-First)

*Companion to the product/UX spec. This describes the on-device data model and how it syncs. The schema is written tech-neutrally — it maps cleanly onto SQLite tables (WatermelonDB, drift, expo-sqlite) or document collections (RxDB), and onto a Postgres backend for the server side.*

---

## 1. How offline-first shapes the schema

The app must be fully usable with no connection and reconcile later, so the model follows five rules everywhere:

1. **IDs are generated on the device**, not by the server. Use **UUID v7** (time-ordered, so rows also sort naturally by creation). Auto-increment integer keys are unusable offline because two devices would mint the same id.
2. **Every syncable row carries bookkeeping**: `created_at`, `updated_at`, `deleted_at` (soft delete / tombstone), and `sync_status`. Nothing is ever hard-deleted on the device — deletes are tombstones that propagate, then get purged after they've synced.
3. **History is append-only.** Measurement values are never updated in place; a change writes a new immutable row. Append-only data effectively cannot conflict, which is exactly what you want over a flaky connection — and it's also the table that satisfies the "keep the previous sleeve length" requirement for free.
4. **Binaries never live in a row.** Photos sit on the device filesystem; the database stores a local URI, an (eventual) remote URL, and an upload status. The image bytes sync through their own background queue, not through the row.
5. **Conflict resolution is last-write-wins per row**, keyed on `updated_at`, with the server stamping the authoritative time at sync to absorb device-clock skew. Because the high-churn data (values) is append-only, true conflicts are rare and land only on small edits like renaming a client.

---

## 2. Entities at a glance

```
clients ──1:N── measurement_sets ──1:N── measurement_items ──1:N── measurement_values   (append-only history)
   │                    │
   │                    └──1:N── images
templates ──1:N── template_items
app_settings (single local row)
sync_outbox  (optional, engine-dependent)
```

A **client** has many **sets** (a set = one garment's worth of measurements, with an optional label). A set has many **items** (Neck, Sleeve length…). Each item has many **values** over time, the newest being the current one. **Templates** are the reusable blueprints sets are created from.

---

## 3. Tables

### clients
| field | type | notes |
|---|---|---|
| id | uuid v7 | PK, device-generated |
| name | text | **required** — the only field needed to create a client. **Unique** among non-deleted clients (case-insensitive, trimmed; repo-enforced, since WatermelonDB has no DB-level unique constraints). Blank names are exempt: an unnamed draft is a placeholder client with `name = ''` until it's named on save. |
| phone | text? | optional |
| comment | text? | client-level note for general preferences ("prefers slim fit") |
| photo_local_uri | text? | filesystem path on device |
| photo_remote_url | text? | filled after upload |
| created_at | int (epoch ms) | |
| updated_at | int (epoch ms) | drives last-write-wins |
| deleted_at | int? | tombstone |
| sync_status | enum | `pending` \| `synced` |

### templates
| field | type | notes |
|---|---|---|
| id | uuid v7 | PK |
| name | text | e.g. "Men's", "Women's" |
| is_default | bool | exactly one true per device; new measurements seed from it |
| created_at / updated_at / deleted_at / sync_status | | as above |

### template_items
| field | type | notes |
|---|---|---|
| id | uuid v7 | PK |
| template_id | uuid | FK → templates |
| key | text | measurement name ("Sleeve length") |
| position | int | explicit ordering (the tailor's habitual order) |
| unit | enum | default `in`; reserved for future cm support |
| min_range | real? | optional soft-validation floor (inches) |
| max_range | real? | optional soft-validation ceiling |
| created_at / updated_at / deleted_at / sync_status | | |

### measurement_sets
| field | type | notes |
|---|---|---|
| id | uuid v7 | PK |
| client_id | uuid | FK → clients — **required and immutable** (a set always belongs to a client and never relinks). Measure-first drafts satisfy this with a blank-named placeholder client, named in place on save (spec §4). |
| template_id | uuid? | soft reference — template may later change or be deleted |
| template_name_snapshot | text? | denormalized so the set still reads correctly if the template is renamed/deleted |
| label | text? | optional ("Wedding agbada") |
| note | text? | one free-text note per set |
| created_at / updated_at / deleted_at / sync_status | | |

### measurement_items
One row per measurement line inside a set. Holds a **cached current value** for fast reads; the source of truth for history is `measurement_values`.

| field | type | notes |
|---|---|---|
| id | uuid v7 | PK |
| set_id | uuid | FK → measurement_sets |
| key | text | "Sleeve length" (copied from the template at creation; editable, supports ad-hoc items) |
| position | int | order within the set |
| unit | enum | default `in` |
| current_value | real? | canonical decimal inches (e.g. 16.5); null until first measured |
| current_value_at | int? | timestamp of the current value |
| created_at / updated_at / deleted_at / sync_status | | |

### measurement_values — the history table (append-only)
The heart of the per-item history requirement. **Never updated, never deleted.** Each re-measure of an item inserts one new row; the latest by `recorded_at` is "now," everything older is history.

| field | type | notes |
|---|---|---|
| id | uuid v7 | PK |
| item_id | uuid | FK → measurement_items |
| value | real | canonical decimal inches |
| recorded_at | int (epoch ms) | when it was taken |
| source | enum? | `manual` \| `voice` (future) — provenance |
| created_at | int | |
| sync_status | enum | append-only rows only ever go `pending → synced` |

> No `updated_at` / `deleted_at` here on purpose: immutable rows can't conflict and never need tombstones.

### images
| field | type | notes |
|---|---|---|
| id | uuid v7 | PK |
| set_id | uuid | FK → measurement_sets |
| kind | enum | `card` (paper card) \| `camera` \| `gallery` |
| local_uri | text | filesystem path; always present first |
| remote_url | text? | filled after successful upload |
| upload_status | enum | `pending` \| `uploading` \| `uploaded` \| `failed` |
| width / height | int? | |
| created_at / updated_at / deleted_at / sync_status | | |

### app_settings (local, single row)
Units, fraction granularity (`quarters` \| `eighths`), `default_template_id`, shop/tailor name and logo URI, app-lock on/off, text size, range-warnings on/off, last successful sync time. Mostly device-local; the shop profile bits can sync if you add accounts.

### sync_outbox (optional)
If your sync engine doesn't track dirty rows for you, keep an outbox: `id`, `entity`, `entity_id`, `op` (`upsert`/`delete`), `payload`, `created_at`, `attempts`. The sync loop drains it oldest-first and clears entries on server ack. Engines like WatermelonDB and PowerSync handle this internally, so you'd skip this table when using them.

---

## 4. The per-item history mechanism, worked through

A tailor re-measures Tunde's "Wedding agbada" and only the sleeve got longer:

1. Open the set → load `measurement_items` (each shows `current_value`).
2. They change Sleeve length 26 ½ → 26 ¾, and touch nothing else.
3. On save, for **each item compare the entered value to `current_value`**:
   - Sleeve length differs → insert a `measurement_values` row `{item_id, value: 26.75, recorded_at: now}` **and** update the item's `current_value`/`current_value_at`.
   - Every other item is unchanged → **no write at all**. Their existing `current_value` and history stay exactly as they were.
4. Viewing history for an item = `SELECT value, recorded_at FROM measurement_values WHERE item_id = ? ORDER BY recorded_at DESC`. The first row is "now," the rest are the timeline. The old 26 ½ is preserved automatically.

This is why values are append-only and separate from the item: the requirement ("keep the previous sleeve length even though only sleeve length changed") falls out of the structure instead of needing special diffing logic.

---

## 5. Photos & the upload queue

- On capture/pick, write the file to app storage and insert an `images` row with `local_uri` and `upload_status = pending`. The UI shows the thumbnail immediately from the local file — **no network needed to attach a photo.**
- A background worker drains pending images when online: `pending → uploading → uploaded` (filling `remote_url`) or `→ failed` with retry/backoff.
- The "snap the paper card" migration path is just an image with `kind = card`.
- Never block the measurement session on an upload, and never store the bytes in the DB row.

---

## 6. Sync metadata & conflict strategy

- **Direction:** two-way. Pull server changes since `last_synced_at`, push local rows where `sync_status = pending` (and tombstones where `deleted_at` is set).
- **Keying:** device-generated UUIDs mean a row created offline keeps its identity forever — no id remapping on first sync.
- **Conflicts:** last-write-wins by `updated_at`, server-authoritative timestamp. Acceptable here because (a) it's typically one tailor per account, and (b) the only mutable rows are small metadata (client name/comment, set label/note, template edits). The high-volume data — values — is append-only and merges by union of ids, so it never conflicts.
- **Deletes:** soft via `deleted_at`; the server keeps the tombstone until all the user's devices have seen it, then both sides can purge.
- **Clock skew:** stamp `updated_at` on the device for ordering locally, but let the server overwrite with its receive-time on push so cross-device comparisons use one clock.
- **Schema versioning:** keep a migrations table; bump a `schema_version` so old installs migrate cleanly.

---

## 7. Indexes & common queries

- `clients(name)` — client search; also index `phone`.
- `measurement_sets(client_id, deleted_at)` — a client's sets.
- `measurement_items(set_id, position)` — render a set/entry screen in order.
- `measurement_values(item_id, recorded_at DESC)` — current value + history; the most-hit index.
- `images(set_id)` and `images(upload_status)` — the set's photos and the upload queue.
- Partial/global: rows where `sync_status = pending` — the push set each sync.

---

## 8. Recommended tech (current as of mid-2026)

Pick by how much you want to own vs. rent; the schema above doesn't change between them.

- **WatermelonDB** (React Native) — reactive SQLite, built for large local datasets, with its own dirty-row tracking. It gives you the most control but the most work, since you build the sync server yourself. Good when data must stay in your own infrastructure.
- **PowerSync** — managed engine that syncs Postgres (and MongoDB) to on-device SQLite, with React Native support and a hosted sync layer. Least work to set up, but you pay for the managed service.
- **ElectricSQL (+ TanStack DB)** — open-source sync engine that syncs Postgres to local SQLite in real time with offline support; the open-source middle ground between the two above.
- **RxDB** — offline-first NoSQL that stores locally in IndexedDB/SQLite with replication plugins to any backend, handy if you prefer a document model or a PWA.
- **Flutter?** Use **drift** for the local SQLite layer. If you're already on Postgres, PGlite + ElectricSQL or PowerSync is the most coherent path; with no existing backend, Supabase + RxDB gets you going fastest.

One thing to avoid: Realm's Atlas Device Sync was deprecated in September 2024 — don't start a new project on it for sync.

A pragmatic default for this app: **SQLite on the device (WatermelonDB or drift) + a Postgres/Supabase backend**, with the append-only values table doing the heavy lifting so you can keep conflict handling to simple last-write-wins. Only reach for CRDTs (Yjs/Automerge) if you add real collaborative editing — most offline-first apps just need queued writes that sync, which is a far simpler problem. You don't have that requirement.

---

## 9. Local-only vs synced

- **Synced:** clients, templates, template_items, measurement_sets, measurement_items, measurement_values, images (+ binaries via the queue).
- **Local-only (unless you add accounts):** most of `app_settings` (units, text size, app-lock). Shop profile and `default_template_id` are worth syncing once a tailor uses more than one device.
