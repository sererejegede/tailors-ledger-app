# Tailor Measurement App — Data Model (Offline-First)

*Companion to the product/UX spec. This describes the on-device data model and how it syncs. The schema is written tech-neutrally — it maps cleanly onto SQLite tables (WatermelonDB, drift, expo-sqlite) or document collections (RxDB), and onto a Postgres backend for the server side.*

---

## 1. How offline-first shapes the schema

The app must be fully usable with no connection and reconcile later, so the model follows five rules everywhere:

1. **IDs are generated on the device**, not by the server. Use **UUID v7** (time-ordered, so rows also sort naturally by creation). Auto-increment integer keys are unusable offline because two devices would mint the same id.
2. **Every syncable row carries bookkeeping**: `created_at`, `updated_at`, `deleted_at` (soft delete / tombstone), and a push/pull status. (On the actual WatermelonDB store this status is the engine's built-in `_status`/`_changed`, **not** a `sync_status` column — see §6.) Nothing is ever hard-deleted on the device — deletes are tombstones that propagate, then get purged after they've synced. The one exception is an unused starter template that never left the device (§1b).
3. **History is append-only.** Measurement values are never updated in place; a change writes a new immutable row. Append-only data effectively cannot conflict, which is exactly what you want over a flaky connection — and it's also the table that satisfies the "keep the previous sleeve length" requirement for free.
4. **Binaries never live in a row.** Photos sit on the device filesystem; the database stores a local URI, an (eventual) remote URL, and an upload status. The image bytes sync through their own background queue, not through the row.
5. **Conflict resolution is last-write-wins per row**, keyed on `updated_at`, with the server stamping the authoritative time at sync to absorb device-clock skew. Because the high-churn data (values) is append-only, true conflicts are rare and land only on small edits like renaming a client.

---

## 1a. Lazy create — no empty rows

A measurement session writes **nothing** until the tailor saves. Opening the
measurement-entry screen does not create a client, set, or items; the item list is
seeded from the template **in memory**, and ad-hoc items added mid-session are held in
memory too. On save, one transaction creates everything that has real content:

- **measure-first** (no client yet): the tailor names the draft on save; that name creates
  a new `clients` row, then the `measurement_sets` row, its `measurement_items`, and a
  `measurement_values` row for each measured item.
- **client-first** (started from a client): the same, reusing the existing `client_id`.

Only items that were actually measured get a `measurement_values` row + cached
`current_value`; the rest are written empty, exactly like a template-seeded set. This
keeps the store from filling with abandoned "Unnamed" drafts and empty sets — backing out
of the screen leaves the database untouched. (Earlier drafts of this model persisted an
in-progress session immediately as a set under a blank-named placeholder client; that is
superseded by lazy create.)

> **Continuous autosave** (spec §4) is a later enhancement, not built in v1. When added it
> must stay empty-safe: defer the first write until there is a value or a name, so it never
> reintroduces empty drafts.

---

## 1b. Starter templates across devices

Every install seeds the starter templates (spec §10) locally, before any sign-in, so the
app works offline from first launch. When that device signs into an account, its seed must
not leak into an account that already has templates.

- **Seed rows use ordinary device-generated UUID v7**, like every other row. Fixed,
  deterministic seed ids are not allowed: they are identical on every install of every user,
  so the first account to sync them owns them and every other account's seed is rejected
  (`id_conflict`).
- **A device's first sync pulls before it pushes** (sync contract §12), so it knows whether
  the account already has templates before it sends anything.
- **Discard rule.** If the account already has templates (any synced, non-deleted template
  on the device), each local starter template is **hard-deleted together with its items**
  when all of these hold:
  - it has never synced;
  - it is untouched: its name, item keys and item order match the starter exactly, nothing
    was added or removed, and no row was edited (`updated_at` = `created_at`);
  - no `measurement_sets` row (deleted or not) references it.

  Nothing was ever sent for these rows, so there is no tombstone to propagate. The
  `app_settings.default_template_id` pointer does not count as a reference; it is
  repointed (below).
- **Kept starters.** A starter template that fails the discard rule is user data and is
  pushed. On an account that already has templates it is pushed with `is_default = false`.
- **Legacy fixed ids.** Builds from 9 July 2026 seeded with fixed ids. Any such row that has
  never synced and is kept is re-created under a fresh UUID v7, with its items, the sets that
  reference it and the default pointer repointed, before it is pushed.
- **One default per account.** After each pull, if several non-deleted templates have
  `is_default = true`, the most recently updated one wins and the rest are set to false
  (a normal synced edit). `app_settings.default_template_id` follows the winner.

---

## 2. Entities at a glance

```
clients ──1:N── measurement_sets ──1:N── measurement_items ──1:N── measurement_values   (append-only history)
   │                    │
   │                    └──1:N── images
clients ──1:N── jobs ──1:N── job_items ┄┄ measurement_sets   (optional soft link)
                  │
                  └──1:N── payments   (one payment = one receipt)
templates ──1:N── template_items
app_settings (single local row)
sync_outbox  (optional, engine-dependent)
```

A **client** has many **sets** (a set = one garment's worth of measurements, with an optional label). A set has many **items** (Neck, Sleeve length…). Each item has many **values** over time, the newest being the current one. **Templates** are the reusable blueprints sets are created from.

A **job** is one piece of work for one client: the clothes being made and the money paid towards them. Each cloth is a **job item**, and every **payment** on the job is one receipt.

---

## 3. Tables

### clients
| field | type | notes |
|---|---|---|
| id | uuid v7 | PK, device-generated |
| name | text | **required** — the only field needed to create a client, and set at creation time. **Unique** among non-deleted clients (case-insensitive, trimmed; repo-enforced, since WatermelonDB has no DB-level unique constraints). A client row is never written until there's a real name to give it (see §1a, lazy create), so blank-named placeholder clients are not created. (The repo's uniqueness check still exempts blank names defensively, but the app never produces one.) |
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
| is_default | bool | exactly one true per account, reconciled after each pull (§1b); new measurements seed from it |
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
| client_id | uuid | FK → clients — **required and immutable** (a set always belongs to a client and never relinks). A measure-first session is not persisted while in progress; on save the set and its (newly created or pre-existing) client are written together, so `client_id` is valid from creation (see §1a). |
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

### jobs
| field | type | notes |
|---|---|---|
| id | uuid v7 | PK |
| client_id | uuid | FK → clients — **required and immutable** |
| title | text? | optional ("Wedding outfits") |
| currency | text | ISO code, copied from `app_settings.currency` at creation, e.g. `NGN` |
| collect_on | int? (epoch ms) | collection date |
| note | text? | |
| created_at / updated_at / deleted_at / sync_status | | |

The job's total and balance are **never stored**. Both are calculated from `job_items` and `payments`, so two devices can't disagree about them. A job is written whole on save, like a set (§1a); backing out leaves nothing.

### job_items
One row per cloth on a job.

| field | type | notes |
|---|---|---|
| id | uuid v7 | PK |
| job_id | uuid | FK → jobs |
| description | text | "Agbada, 3-piece" |
| quantity | int | default 1 |
| unit_price_minor | int? | price of one, in minor units; null until priced. A line counts as 0 towards the total while unpriced |
| set_id | uuid? | soft reference to `measurement_sets`, like `measurement_sets.template_id`: the item survives the set being deleted |
| position | int | order on the job |
| created_at / updated_at / deleted_at / sync_status | | |

### payments
One row per payment. **A payment is a receipt.**

| field | type | notes |
|---|---|---|
| id | uuid v7 | PK |
| job_id | uuid | FK → jobs |
| receipt_number | int | printed as `R-0042`. Not unique across devices (see below) |
| amount_minor | int | always above 0 |
| paid_at | int (epoch ms) | |
| receipt_json | text | what the receipt printed, frozen at save (below) |
| voided_at | int? | set when voided; a voided payment no longer counts towards the balance |
| created_at / updated_at / deleted_at / sync_status | | `deleted_at` exists for the sync pipeline; the app never sets it |

**Money.** Amounts are integers of minor units (₦50,000 is `5000000`), never decimals. The tailor enters whole naira; kobo exist so the format works for any currency.

**Balance.** `total − sum(amount_minor of payments not voided)`. It can go below 0: a job with unpriced items can take a deposit larger than its total so far. This is shown, never blocked.

**Frozen receipts.** `receipt_json` holds a snapshot written once, at save, so re-sending an old receipt never changes it, whatever happens to the job, the client or the shop profile later. The logo is the exception: it's a file on the device, so a receipt always shows the current one.

```json
{
  "v": 1,
  "kind": "Deposit",
  "shop": { "name": "Kunle Couture", "phone": "+234 803 555 0142", "address": "14 Allen Avenue, Ikeja", "footer": "Goods not collected after 3 months may be disposed of." },
  "client_name": "Tunde Bello",
  "job_title": "Wedding outfits",
  "collect_on": 1794614400000,
  "currency": "NGN",
  "items": [{ "description": "Senator suit", "quantity": 2, "unit_price_minor": 3000000, "line_total_minor": 6000000 }],
  "total_minor": 11000000,
  "paid_so_far_minor": 5000000,
  "balance_minor": 6000000
}
```

`kind` is decided at save: `Full payment` when the first payment clears the job, `Final payment` when a later one does, `Deposit` for any other first payment, `Part payment` otherwise. A voided receipt shows VOID, and its paid-so-far and balance are shown without its own amount.

**Voiding.** A receipt is voided, never edited or deleted. Its number stays used.

**Receipt numbers.** The next number is the higher of `app_settings.next_receipt_number` and the highest number on the device plus one, so a tailor can continue from a paper receipt book. Numbers are never reused, including after a void. Two offline phones can mint the same number, which is why the server doesn't require uniqueness.

### app_settings (local, single row)
Units, fraction granularity (`quarters` \| `eighths`), `default_template_id`, app-lock on/off, text size, range-warnings on/off, last successful sync time, and the **shop profile**: `shop_name`, `logo_uri`, `shop_phone`, `shop_address`, `receipt_footer`, `currency` (ISO code, default `NGN`), `next_receipt_number` (default 1). Mostly device-local; the shop profile bits can sync if you add accounts.

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
- **Deletes:** soft via `deleted_at`; the server keeps the tombstone until all the user's devices have seen it, then both sides can purge. Deletes sync as **bare ids** (no timestamp on the wire), so delete-vs-edit LWW compares against a **server-stamped tombstone time** (resolved 2026-06-25 — see sync-contract §9).
- **Clock skew:** stamp `updated_at` on the device for ordering locally, but let the server overwrite with its receive-time on push so cross-device comparisons use one clock.
- **Dirty-tracking & cursor (resolved 2026-06-25):** on the WatermelonDB device store the
  `sync_status` concept is the engine's built-in **`_status`/`_changed`** — there is **no
  separate `sync_status` column** (it never crosses the wire anyway). The pull **cursor** is
  the contract's opaque `server_seq` string, persisted in `app_settings.sync_cursor`
  (+ `last_synced_at`); WatermelonDB's numeric `lastPulledAt` is not used as the checkpoint.
- **Schema versioning:** keep a migrations table; bump a `schema_version` so old installs migrate cleanly.

---

## 7. Indexes & common queries

- `clients(name)` — client search; also index `phone`.
- `measurement_sets(client_id, deleted_at)` — a client's sets.
- `measurement_items(set_id, position)` — render a set/entry screen in order.
- `measurement_values(item_id, recorded_at DESC)` — current value + history; the most-hit index.
- `images(set_id)` and `images(upload_status)` — the set's photos and the upload queue.
- `jobs(client_id)`, `job_items(job_id)`, `payments(job_id)` — a client's jobs with their items and payments.
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

- **Synced:** clients, templates, template_items, measurement_sets, measurement_items, measurement_values, images (+ binaries via the queue), jobs, job_items, payments.
- **Local-only (unless you add accounts):** most of `app_settings` (units, text size, app-lock). Shop profile and `default_template_id` are worth syncing once a tailor uses more than one device.
