# Rejected rows — plan for a full fix

*Written 2026-11-05. Not built yet, except step 0 (below). Pick this up as its own piece of work.*

## The problem

When the server refuses a pushed row, it returns `{ entity, id, reason }` (sync contract §6).
The app keeps the row waiting and re-sends the same row on every sync, so a rejection that
depends only on the row repeats forever. Today the tailor sees only "N changes couldn't sync"
in Settings: no row, no reason, no fix. The count lives in memory and disappears on restart.
Each stuck row also counts as "not backed up", so it gets in the way of signing out and
switching account (data model §1c).

## Why rows get rejected for good

The server checks a pushed row in this order (backend `src/sync.ts`, `runPush`):

1. **Fields** (`src/schemas.ts`) — `name_required`, `key_required`, `description_required`,
   `quantity_invalid`, `currency_invalid`, `receipt_number_invalid`, `receipt_required`,
   `<field>_invalid` (bad uuid, negative timestamp, unknown unit).
2. **Owner** — `id_conflict`: the id is already held by another account. Ids are global.
3. **Parent** — `<fk>_not_found`: the parent isn't on the server under this account.

Because the owner check comes before the parent check, a row rejected `<fk>_not_found` is not
on any account. Only `id_conflict` proves the row is backed up somewhere.

| Reason | Realistic source | Fix |
|---|---|---|
| field check | rows from old builds (blank-named "Unnamed" drafts) | edit the row; values and payments can't be edited |
| `id_conflict` | another account's rows left on the device by builds before §1c; old fixed-id starters (now re-keyed) | remove from this phone (step 0) |
| `<fk>_not_found`, parent missing on the phone | orphans from old drafts and manual cleanup | remove (existing Settings clean-up, step 0) |
| `<fk>_not_found`, parent rejected | children of any row above | fix or remove the parent |
| `<fk>_not_found`, parent soft-deleted on the phone | a row added under something deleted | delete the row too |

## Step 0 — done now (2026-11-05)

When a sync rejects rows as `id_conflict` or as orphans (parent missing on the phone), a
confirm lists that data by client and offers to remove it from this phone. It says which
parts are backed up on another account and which were made on this phone and will be lost.
See data model §1d.

## The full fix

1. **Keep rejections.** Store the last rejection per row (`entity`, `id`, `reason`, time) in
   WatermelonDB's local storage, not `app_settings` (no schema change). Drop an entry when the
   row syncs or is removed. Settings can then show the count after a restart, and checks like
   sign-out can tell "rejected" from "not pushed yet".
2. **"Couldn't sync" screen.** Tapping the count opens a list grouped by client, in plain words:
   - field problem → "Client with no name — Edit" (opens the right screen);
   - can't be edited (a measurement or payment) → "Remove from this phone", with what is lost;
   - parent problem → "Fix Tunde Bello first", linking to the parent's entry;
   - another account's data → the step 0 clean-up.
3. **Validate before saving.** Mirror the server's field rules in the repositories, so a row
   the server would reject can't be created (most already are).
4. **Sign-out and switching.** Leave rejected rows out of the "not backed up" count that
   blocks a switch, but name them in the sign-out confirm, so one bad row can't pause sync for
   the next account forever.
5. **Tests.** One per reason: rejected, listed with the right fix, fixed or removed, then the
   next sync is clean.

## Open questions

- Should a rejected row ever be removed without asking? (Suggested: never.)
- Should an un-editable bad row (a measurement, a payment) be repairable by the tailor, or only
  removable?
