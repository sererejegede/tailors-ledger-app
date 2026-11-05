# Tailor Measurement App — v1 Product & UX Spec

*Working draft. Built from our UX finetuning session. Everything here is meant to be edited — the "Assumptions to confirm" section at the end lists the places I made a reasonable call so we can keep moving.*

---

## 1. North star

Replace the paper measurement card without losing what makes it fast and accurate. Every design choice is judged against one question: **is this as easy, fast, and accurate as doing it by hand?** If a feature makes the app "smarter" but slower at the measuring moment, it loses.

The measuring moment is the whole product. Storage, history, and templates are supporting scaffolding and can stay conventional.

---

## 2. Design principles

- **Tap-first.** The number entry is the hero of the app and must work whether the tailor records solo (one hand on the tape) or an assistant records while the tailor calls out. Voice is a later accelerator, not a dependency.
- **Mirror the card, don't build a wizard.** Show all of a garment's items at once in the tailor's habitual order; let them fill in any sequence and skip freely. Never force completion or order.
- **Fractions are native.** Inches with ¼ / ½ / ¾. No fishing for a decimal point.
- **Offline-first.** A measurement session never depends on connectivity. Everything writes locally; sync and image upload happen in the background.
- **Non-blocking.** Nothing stands between the tailor and the tape — not client forms, not uploads, not validation.

---

## 3. Core concepts (data model)

```
Client
 ├── Comment                (general preferences, not tied to any one set)
 └── Measurement Set        (optional label, created from a template)
      ├── Note               (one free-text note per set)
      ├── Image[]            (optional photos, incl. a snapshot of the old paper card)
      └── Item[]             (the key/value pairs)
           ├── current value
           └── value history[]   (timestamped previous values)
```

**Client** — minimal: **name (required)**; phone, photo, and comment are all optional and fillable later. A client can be created or attached with nothing but a name, and the rest filled in whenever convenient (or never). **Client names are unique** (compared case-insensitively, trimmed): the app won't let two clients share a name, so a name reliably identifies one person. An in-progress **unnamed draft** (see §4) is not yet a client record — it's held in memory and only becomes a (named) client on save. The **comment** is a free-text, client-level note for general preferences that don't belong to any single set — e.g. "prefers slim fit", "no tight collars".

**Template** — an ordered list of item keys (e.g. Neck, Chest, Shoulder, Sleeve Length, …), with a default unit (inches) per item and an optional expected range for soft validation. Templates are reusable across clients and editable. They are general-purpose — the practical thing that distinguishes one from another tends to be **sex** (e.g. a women's template includes bust where a men's wouldn't), not garment type.

**Measurement Set** — a set of measurements for one client, created from a template, with an **optional label** (e.g. "Wedding outfit"). No garment-type concept — a client simply has one or more labelled (or unlabelled) sets.

**Item** — one measurement: a key (e.g. "Sleeve Length") and a value. Stored internally as a decimal (16.5) but always displayed and entered as inches-and-fraction (16 ½).

**Item value history — the key rule:** each item keeps its own timestamped history. Re-measuring writes a new history entry **only for items whose value actually changed**; untouched items keep their current value and history intact. So changing only the sleeve length leaves the old sleeve length recorded and touches nothing else.

---

## 4. The measurement screen (the part that matters)

This is the screen the whole product lives or dies on.

**Client association (before or after).** Identifying the client must never block measuring. The tailor can either pick/create the client first, or **start measuring immediately and attach the client afterward** — and attaching needs nothing but a name. (Phone, photo, and comment are filled later, or never.) So a valid flow is: walk up, measure, then type the client's name to save the set against them. Until then the session is an in-progress draft held **in memory only** — nothing is written to the store yet. On save, the client (created from the name typed in, or the one chosen up front) and the set are written together in one step, so the required, permanent set→client link is valid from creation. The name must be unique among existing clients. (See the data-model doc, §1a "Lazy create": this avoids the store filling with abandoned "Unnamed" drafts — backing out before saving leaves nothing behind.)

**Layout.** The template's items render as a scrollable list in order, each row showing the item name and its current value. The list scrolls in the upper area; the **input control is docked at the bottom** of the screen in the thumb zone, so it never moves out of reach during one-handed use.

**The input control (inches + quarters).**
- A whole-number pad (0–9, plus delete).
- A row of fraction chips: `¼  ½  ¾` (and an implicit "none" for whole numbers).
- A prominent **Next** button.

**Entering a value.** Type the inches → tap a fraction chip (or skip it) → tap **Next**. Focus auto-advances to the next empty item. Roughly two-to-three taps per measurement, all in the thumb zone.

**Moving around.** Tap any row to jump the input straight to it. Skip freely and come back. A small **"X of Y filled"** indicator shows what's outstanding. No forced order, no forced completion.

**Ad-hoc items.** The tailor can add an item that isn't in the template mid-session (shops improvise), with an option to push that item back into the template for next time.

**Autosave / drafts.** *(Later enhancement — not in v1.)* The intent is for the in-progress set to autosave continuously so a client walking off mid-session never loses work. v1 holds the session in memory and persists on save (lazy create, see data-model §1a); when continuous autosave is added it must stay empty-safe — defer the first write until there's a value or a name so it never reintroduces empty drafts.

**Saving.** On save, if items are still empty, show a light **"2 items still empty — save anyway?"** confirm rather than blocking. Saves locally and syncs in the background.

---

## 5. Re-measuring / updating

Re-measure opens the same measurement screen with **current values pre-filled**. The tailor only touches what changed. On save:
- changed items get a new history entry,
- unchanged items are left completely alone.

Before saving, items edited this session carry a subtle "changed" marker so the tailor can sanity-check what they're about to overwrite. A single item can also be quick-edited directly from the set-detail screen (also writes history).

---

## 6. Screen map

| Screen | Purpose |
|---|---|
| **Clients** (home tab) | Search-first list of clients (by name/phone), with "This week" tiles: jobs due and money still owed. One **+** button opens *New measurement* and *Add client*. |
| **Jobs** (tab) | Every job, filtered All / Still owed / Paid and grouped into Due this week, Later and No date yet. |
| **Client detail** | Client info with *Call* and *WhatsApp*, the client-level **comment**, + list of their measurement sets (shown by label, or by date if unlabelled — e.g. "Wedding outfit — 2 wks ago", "12 May"), + their latest 3 jobs and what each still owes, with *View all*. Actions: *Add job*, *New measurement*. |
| **Client's jobs** | All of one client's jobs, grouped Still owed and Paid. |
| **Measurement entry** | The hero screen in §4. Used for new sets and re-measures. |
| **Set detail (view)** | All items with current values, the set note, images, and a *Re-measure* button. Tap any item to see its history or quick-edit. |
| **Item history** | Timeline of an item's previous values with dates. |
| **Templates** | Opens from Settings. List, create, and edit templates (ordered items, default unit, optional ranges). |
| **New client** | Name only to create; phone, photo, comment all optional and deferrable. Instant. |
| **New job** | §9a. Its own screen, opened by *Add job* on Client detail. Title, items (name and price), due date; *Create job* at the bottom. |
| **Job detail** | The job's balance, items and payments. Items are added or repriced in the list. Actions: *Send invoice*, *Record payment* (a sheet with the amount pad). |
| **Shop profile** | Opens from Settings: logo, name, phone, address, receipt footer, next receipt number, currency. |
| **Payment details** | Opens from Settings: bank, account name, account number, as printed on invoices. |
| **Receipt preview** | The receipt as it will print. Actions: *Share*, *Void receipt*. |
| **Invoice preview** | The job's invoice as it will print. Actions: *Share*, *Add collection date* when none is set, otherwise *Change* (which can also clear it). |

---

## 7. Accuracy & safety features

- **Inches-and-quarters entry** removes the most common keypad error (decimal mistypes).
- **Optional expected range per item** (set on the template) gives a soft, non-blocking warning when a value is wildly off — catches "1.6" vs "16" slips without nagging.
- **Autosave drafts** prevent lost sessions.
- **Save-incomplete confirm** prevents accidental half-finished saves without forcing completion.
- **Per-item history** means an accidental overwrite is always recoverable.

---

## 8. Notes & images

- **One free-text note per set** (set-level only in v1).
- **Optional images per set**: camera or gallery, multiple allowed, uploaded via a background queue so it never blocks the session. A photo of the tailor's existing **paper card** is a first-class image and the intended migration path — onboard clients gradually by snapping their old cards.

---

## 9a. Jobs and receipts

A **job** is one piece of work for one client: the clothes being made and the money paid towards them. Every payment gives one **receipt**.

- **A job starts from *Add job* on Client detail**, on its own New job screen. Items sit in a list with *+ Add item* last; each takes a name and a price. The number pad opens only when a price is tapped, with *Save* in its corner. *Create job* is at the bottom, and nothing is written until it's tapped.
- **Payments are recorded from Job detail.** *Record payment* opens a sheet with the amount pad; Save opens the new receipt.
- **An item's price is optional.** The data can link an item to one of the client's measurement sets, but the screens don't show that link.
- **A job is Still owed** while its balance is above 0, **otherwise Paid**. Its collection date is shown as "Due …" on the tailor's screens; the receipt says "Collect by".
- **A job's title and collection date are optional.** The date is set with quick picks (1, 2, 3 weeks, 1 month) and a day-by-day ±, so there's no calendar to fish through.
- **No payment method is recorded.**
- **Paying more than the balance asks first** ("Record it anyway?"), so a mistyped amount is caught. It is never blocked.
- **The receipt** is A5, carries the shop's logo and details, and lists every item on the job. One *Share* button makes a PDF and opens the phone's share sheet. It all works offline.
- **Mistakes are voided**, never edited or deleted. Each receipt keeps exactly what it printed.
- **The shop profile** (logo, name, phone, address, footer, next receipt number, currency, and payment details: bank, account name, account number) lives in Settings, on the phone only.
- **Invoices** are the job's bill, shared from *Send invoice* on Job detail. One *Share* button makes the PDF, like the receipt. An invoice is never saved and has no number: it's drawn from the job each time, so it always shows the job as it is now. It carries the client's phone and the shop's payment details when they're set. If the job has no collection date, *Add collection date* sets one (saved to the job); once set, *Change* picks another or clears it.

Rules and fields are in the data-model doc, §3.

---

## 9. Offline & sync

- Local-first storage; the app is fully usable with no connection.
- Background sync when connectivity returns; image uploads queue separately and retry.
- v1 assumes effectively single-device use per tailor; last-write-wins per item is sufficient. Multi-device conflict handling is deferred.

---

## 10. Starter content (onboarding)

Ship with a small set of editable starter templates so a tailor isn't staring at an empty app on first run. Since templates are general-purpose and the real divergence between them is **sex** (a women's template carries bust and similar items a men's wouldn't), the sensible defaults are a **Men's** and a **Women's** base template, each a reasonable common list of items. The tailor edits these or builds their own from scratch; nothing forces a sex label — it's just the practical organizing logic behind the starting content.

A new device signing into an account that already has templates uses the account's templates; its own unused starter templates are discarded rather than added as duplicates (data model §1b).

---

## 11. v1 scope vs. later

**In v1**
- Clients (name-only creation, optional phone/photo/comment), labelled measurement sets per client, templates
- Measure-first-or-client-first flow (attach client with just a name, before or after)
- Tap-only measurement entry (inches + ¼/½/¾, auto-advance, skip/jump)
- Per-item value history + re-measure flow
- Set-level note + images (background upload)
- Offline-first with background sync
- Soft range validation, autosave drafts, Men's/Women's starter templates
- Jobs, payments, shareable receipts and invoices

**Later (architected for, not built)**
- **Voice input** as an entry accelerator for the solo case
- Per-item notes
- Centimeters / unit switching
- Multi-device sync with conflict resolution
- Sharing/exporting a set (e.g. to a cutter)
- Point-in-time "snapshot" of a set tied to a specific order

---

## 12. Settled decisions

All earlier open questions are now resolved:

1. **Client fields** — name is the only requirement; phone, photo, and a client-level **comment** (general preferences) are optional and deferrable. A client can be created/attached with just a name, before *or* after measuring. **Names are unique** (case-insensitive, trimmed). A measure-first draft isn't persisted until save (lazy create, data-model §1a), so it never exists as a blank-named client record — it's created, already named, on save.
2. **Sets** — no garment-type concept. A client has one or more measurement sets, each with an **optional label**.
3. **Storage** — values stored internally as decimal, displayed/entered as inches-and-quarters.
4. **Soft range validation** — included in v1 (small effort, real accuracy gain).
5. **Sync** — single-device assumption for v1; multi-device deferred.
6. **Starter templates** — Men's and Women's base templates (sex is the natural divergence, e.g. bust), editable; not garment-based.

---

## Next step

The spec is settled. The natural follow-on is a **simple flow + wireframe** of the four screens that carry the experience: Clients → Client detail → Measurement entry → Set detail, with the docked input control (number pad + ¼/½/¾ chips + Next) drawn out in detail.
