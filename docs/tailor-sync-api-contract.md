# Tailor Measurement App — Sync API Contract

*The wire contract between the **app repo** (on-device SQLite + sync client) and the **backend repo** (Postgres + sync API). Both repos implement against this doc so they can be built independently. Field-level definitions live in `tailor-app-data-model.md`; this doc defines how those rows move over the network.*

> **Applicability.** This contract is for the **self-built sync** option (e.g. a WatermelonDB client talking to our own endpoints). If you instead choose a **managed engine (PowerSync / ElectricSQL)**, that engine owns the wire protocol and you configure sync rules instead — in that case this doc is a semantics reference only, not an API to build.

---

## 1. Principles

- **Delta sync.** The client pulls "everything changed since my last checkpoint" and pushes "everything I changed locally." No full table transfers after the first sync.
- **UUID-keyed and idempotent.** Every row is keyed by a device-generated UUID v7, so re-sending a change (after a dropped connection) is always safe — pushes are naturally idempotent.
- **Last-write-wins per row**, resolved by `updated_at` (device edit time). The append-only values table never conflicts.
- **Binaries travel out-of-band.** Photo bytes go through a signed-URL upload, never inside a sync payload. Only image *metadata* rides the sync.
- **Per-user.** The server derives the owner from the auth token and scopes every read and write to that user. Clients never send an owner id.
- **Device-local fields never cross the wire.** `*_local_uri` and `sync_status` stay on the device; the server stores and returns only shareable fields (see §11).

---

## 2. Auth

All endpoints require `Authorization: Bearer <token>` (e.g. a Supabase Auth JWT). A missing/expired token returns `401`; the client refreshes and retries. The token identifies the user; all rows are scoped to that user server-side.

Base path is versioned: **`/v1/...`**.

---

## 3. Wire conventions

- JSON over HTTPS; `Content-Type: application/json`.
- Field names are `snake_case`, matching the data-model doc.
- **All timestamps are integer epoch milliseconds** (UTC). Decimal measurement values are JSON numbers in canonical inches (e.g. `26.75`).
- Changes are grouped by entity into a **change envelope**:

```json
{
  "clients":            { "created": [ /* rows */ ], "updated": [ /* rows */ ], "deleted": [ /* ids */ ] },
  "templates":          { "created": [], "updated": [], "deleted": [] },
  "template_items":     { "created": [], "updated": [], "deleted": [] },
  "measurement_sets":   { "created": [], "updated": [], "deleted": [] },
  "measurement_items":  { "created": [], "updated": [], "deleted": [] },
  "measurement_values": { "created": [] },
  "images":             { "created": [], "updated": [], "deleted": [] }
}
```

- `created` / `updated` carry full rows. `deleted` carries bare id strings (tombstones).
- **`measurement_values` only ever has `created`** — it is append-only and immutable, so it never appears in `updated` or `deleted`.

---

## 4. The cursor

The cursor is an **opaque string** the client stores after each successful pull and replays on the next pull/push. `null` (or omitted) means "first sync — send me everything."

Reference implementation: the server keeps a per-user monotonic `server_seq` (bigint) that increments on every applied write. The cursor encodes the highest `server_seq` the client has received. Pull returns rows with `server_seq > cursor` ordered by `server_seq`. This sequence — not wall-clock time — is what makes pull ordering immune to device clock skew (the "server-authoritative checkpoint" from the data-model doc). `updated_at` is kept as the device edit time and used **only** for last-write-wins comparison.

> **Client storage (resolved decision, 2026-06-25).** The app persists this opaque cursor in
> its own side-channel — `app_settings.sync_cursor` (+ `last_synced_at`) — and drives
> WatermelonDB's `synchronize()` with custom `pullChanges`/`pushChanges` that read/write that
> cursor and call `/v1/sync/pull|push`. WatermelonDB's numeric `lastPulledAt` is **not** used
> as the checkpoint (it's wall-clock; our cursor is `server_seq`-based); WatermelonDB is used
> only for its dirty-row tracking and the first-vs-delta signal. See build-plan.md "Open items".

---

## 5. `POST /v1/sync/pull`

**Request**

```json
{ "cursor": "c2VxOjQ4MQ", "limit": 500 }
```

`cursor` null on first sync. `limit` optional (server caps it).

**Response**

```json
{
  "changes": { /* change envelope, scoped to this user, server_seq > cursor */ },
  "cursor": "c2VxOjQ4Mg",
  "has_more": false,
  "server_time": 1718900000123
}
```

- If `has_more` is `true`, the client immediately pulls again with the returned `cursor` until it is `false`. This pages large first syncs.
- Soft-deleted rows arrive as ids in the entity's `deleted` list.

**Example** — a re-measure of one sleeve produced one new value row and bumped the item's cached current value:

```json
{
  "changes": {
    "measurement_items": {
      "created": [],
      "updated": [{
        "id": "0190f2a1-...-e1", "set_id": "0190f2a0-...-aa",
        "key": "Sleeve length", "position": 5, "unit": "in",
        "current_value": 26.75, "current_value_at": 1718900000000,
        "created_at": 1717000000000, "updated_at": 1718900000000, "deleted_at": null
      }],
      "deleted": []
    },
    "measurement_values": {
      "created": [{
        "id": "0190f3b7-...-77", "item_id": "0190f2a1-...-e1",
        "value": 26.75, "recorded_at": 1718900000000, "source": "manual",
        "created_at": 1718900000000
      }]
    }
  },
  "cursor": "c2VxOjQ4Mg",
  "has_more": false,
  "server_time": 1718900000123
}
```

---

## 6. `POST /v1/sync/push`

**Request** — the client's locally-changed rows plus the cursor it last pulled at:

```json
{
  "cursor": "c2VxOjQ4Mg",
  "changes": {
    "clients": {
      "created": [],
      "updated": [{
        "id": "0190f2a0-...-01", "name": "Tunde Bello", "phone": "+234 803 555 0142",
        "comment": "Prefers a relaxed agbada fit.", "photo_remote_url": null,
        "created_at": 1716000000000, "updated_at": 1718905000000, "deleted_at": null
      }],
      "deleted": []
    },
    "measurement_values": {
      "created": [{
        "id": "0190f3b7-...-77", "item_id": "0190f2a1-...-e1",
        "value": 26.75, "recorded_at": 1718900000000, "source": "manual",
        "created_at": 1718900000000
      }]
    }
  }
}
```

**Response**

```json
{
  "applied": { /* canonical server rows for every id the client pushed */ },
  "rejected": [ { "entity": "clients", "id": "0190f2a0-...-01", "reason": "name_required" } ],
  "cursor": "c2VxOjQ4Mw"
}
```

- The server applies the whole push in **one transaction**, assigns a fresh `server_seq` to each write, and resolves conflicts per §9.
- **`applied`** is the server's canonical version of each pushed row. The client overwrites its local copies with these — that's how the device adopts the server's `server_seq` and learns whether its write won or lost. Locally, those rows flip from `pending` to `synced`.
- **`rejected`** lists rows that failed validation; the client keeps them `pending` and surfaces them, or fixes and re-pushes.
- Because pushes are idempotent (UUID-keyed; equal `updated_at` is a no-op; an existing value id is a no-op), a retried push after a flaky connection is safe.

---

## 7. Append-only values (special handling)

`measurement_values` is the one table that never updates or deletes:

- Re-measuring an item = the client inserts **one new** `measurement_values` row (new UUID) and updates the parent `measurement_items.current_value` / `current_value_at`. Both go up in the next push.
- The server only accepts these in `created`. An incoming value id that already exists is ignored (idempotent), never overwritten.
- Two devices adding history for the same item simply **union** by id — there is no conflict to resolve. This is why the high-churn data is conflict-free.

---

## 8. Image upload (out-of-band binaries)

Bytes never go through `/sync`. The flow is sign → PUT → sync-the-row:

1. **`POST /v1/uploads/sign`**

   ```json
   { "image_id": "0190f4c2-...-09", "content_type": "image/jpeg", "byte_size": 824133 }
   ```
   →
   ```json
   {
     "method": "PUT",
     "url": "https://storage.../signed-put?...",
     "headers": { "content-type": "image/jpeg" },
     "remote_url": "https://cdn.../images/0190f4c2-...-09.jpg",
     "expires_at": 1718900600000
   }
   ```

2. The client `PUT`s the bytes directly to `url` (to the storage bucket, not our API).
3. On success the client sets the local `images` row `upload_status = uploaded` and `photo_remote_url`/`remote_url = <remote_url>`, then that row syncs normally on the next push.
4. Other devices receive the `images` row via pull with `remote_url` set. If the bucket is private, they mint a read URL:

   **`GET /v1/uploads/url?image_id=...`** → `{ "url": "https://...signed-get...", "expires_at": 1718901200000 }`

The server should enforce allowed content types (`image/jpeg`, `image/png`, `image/webp`) and a max `byte_size`; the uploaded object key derives from `image_id` so it's stable and idempotent.

---

## 9. Conflict resolution (precise)

For each row in a push (`created` or `updated`):

- If no stored row exists → insert it.
- If a stored row exists → apply the incoming row **iff `incoming.updated_at >= stored.updated_at`** (later edit wins). On an exact tie, the incoming write wins (deterministic). The applied row's `updated_at` is preserved as the device value; the server bumps `server_seq`.
- If the incoming row loses (stored is newer) → the server keeps its version and returns *that* canonical row in `applied`, so the client overwrites its stale local copy.

Deletes (`deleted` ids) are last-write-wins too, but a bare id carries no `updated_at`, so
the comparison uses a **server-stamped tombstone time**: on push the server records the
tombstone at its receive time and resolves delete-vs-concurrent-update by that — a delete
applied after a row's current `updated_at` removes it; an update whose `updated_at` is newer
than the tombstone resurrects the row and wins. (Soft-deleted rows then propagate as
tombstones to other devices.) This keeps the wire format as **bare ids** (§3); we do *not*
send `deleted_at` on the wire. Acceptable because concurrent delete-vs-edit on one row is
rare under the single-user / occasional-multi-device model. *(Resolved decision, 2026-06-25:
LWW with server-stamped delete time — see build-plan.md "Open items".)*

`measurement_values` is exempt — union by id, never a conflict (§7).

> This yields **last-edit-wins per row**, which is acceptable given the data model's single-user / occasional-multi-device assumption. If you later need field-level merging, that's a future protocol bump — not needed now.

---

## 10. Errors & retries

| Status | Meaning | Client action |
|---|---|---|
| 200 | OK | proceed |
| 401 | token missing/expired | refresh auth, retry |
| 409 | cursor too old / pruned | drop cursor, do a full pull (`cursor: null`) |
| 413 | payload too large | halve the batch, retry |
| 422 | validation failed | see `rejected`; fix or shelve those rows |
| 429 | rate limited | exponential backoff (respect `Retry-After`) |
| 5xx | server error | exponential backoff; the whole push is transactional so retry is safe |

The client should never block a measurement session on any sync call — sync runs in the background and retries.

---

## 11. What crosses the wire vs. stays local

| Field | On the wire? | Notes |
|---|---|---|
| `id`, `created_at`, `updated_at`, `deleted_at` | yes | core sync keys |
| `clients.photo_remote_url`, `images.remote_url` | yes | shareable URL |
| `clients.photo_local_uri`, `images.local_uri` | **no** | device-specific path |
| `images.upload_status` | **no** | local bookkeeping; presence of `remote_url` tells other devices it's available |
| `sync_status` | **no** | purely local push/pull state. On device this is **not a column** — dirty-tracking is WatermelonDB's built-in `_status`/`_changed` (resolved decision, 2026-06-25; see data-model §1). |
| `app_settings` (units, text size, app lock) | **no** (mostly) | local; only sync shop profile / `default_template_id` if you add multi-device. The client also persists the opaque pull **cursor** here (`sync_cursor`) + `last_synced_at` — see §4. |

---

## 12. A full sync cycle

1. Authenticate (bearer token).
2. **Sign + upload** any pending image binaries (§8), so their rows can reference a `remote_url`.
3. **Push** local pending rows (upserts + tombstones + new value rows) with the stored cursor. Apply the returned `applied` rows locally; mark them `synced`; handle `rejected`. Save the new cursor.
4. **Pull** with the cursor; apply the returned changes locally; if `has_more`, pull again until `false`. Save the final cursor.

Push-before-pull keeps the client from overwriting its own un-pushed edits with older server state. (A WatermelonDB client that insists on pull-then-push also works, because resolution is server-side and idempotent.)

---

## 13. Knobs to confirm

- **Cursor encoding** (opaque token vs. raw `server_seq`) and the per-user sequence vs. a global one.
- **Batch limits**: default `limit`, max push payload size, image size cap.
- **Tombstone purge window**: how long the server retains deletes before pruning (drives the `409 cursor too old` case).
- **Endpoint shape**: two RPC-style endpoints as above, vs. mapping onto a managed engine's protocol if you go that route (§ applicability note).
