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

**Client** — minimal: **name (required)**; phone, photo, and comment are all optional and fillable later. A client can be created or attached with nothing but a name, and the rest filled in whenever convenient (or never). The **comment** is a free-text, client-level note for general preferences that don't belong to any single set — e.g. "prefers slim fit", "no tight collars".

**Template** — an ordered list of item keys (e.g. Neck, Chest, Shoulder, Sleeve Length, …), with a default unit (inches) per item and an optional expected range for soft validation. Templates are reusable across clients and editable. They are general-purpose — the practical thing that distinguishes one from another tends to be **sex** (e.g. a women's template includes bust where a men's wouldn't), not garment type.

**Measurement Set** — a set of measurements for one client, created from a template, with an **optional label** (e.g. "Wedding outfit"). No garment-type concept — a client simply has one or more labelled (or unlabelled) sets.

**Item** — one measurement: a key (e.g. "Sleeve Length") and a value. Stored internally as a decimal (16.5) but always displayed and entered as inches-and-fraction (16 ½).

**Item value history — the key rule:** each item keeps its own timestamped history. Re-measuring writes a new history entry **only for items whose value actually changed**; untouched items keep their current value and history intact. So changing only the sleeve length leaves the old sleeve length recorded and touches nothing else.

---

## 4. The measurement screen (the part that matters)

This is the screen the whole product lives or dies on.

**Client association (before or after).** Identifying the client must never block measuring. The tailor can either pick/create the client first, or **start measuring immediately and attach the client afterward** — and attaching needs nothing but a name. (Phone, photo, and comment are filled later, or never.) So a valid flow is: walk up, measure, then type the client's name to save the set against them. Until a name is attached, the in-progress set lives as an unnamed draft.

**Layout.** The template's items render as a scrollable list in order, each row showing the item name and its current value. The list scrolls in the upper area; the **input control is docked at the bottom** of the screen in the thumb zone, so it never moves out of reach during one-handed use.

**The input control (inches + quarters).**
- A whole-number pad (0–9, plus delete).
- A row of fraction chips: `¼  ½  ¾` (and an implicit "none" for whole numbers).
- A prominent **Next** button.

**Entering a value.** Type the inches → tap a fraction chip (or skip it) → tap **Next**. Focus auto-advances to the next empty item. Roughly two-to-three taps per measurement, all in the thumb zone.

**Moving around.** Tap any row to jump the input straight to it. Skip freely and come back. A small **"X of Y filled"** indicator shows what's outstanding. No forced order, no forced completion.

**Ad-hoc items.** The tailor can add an item that isn't in the template mid-session (shops improvise), with an option to push that item back into the template for next time.

**Autosave / drafts.** The in-progress set autosaves continuously, so a client walking off mid-session never loses work. Reopening returns to exactly where they left off.

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
| **Clients** (home) | Search-first list of clients (by name/phone). Primary actions: *New measurement*, *Add client*. |
| **Client detail** | Client info, the client-level **comment**, + list of their measurement sets (shown by label, or by date if unlabelled — e.g. "Wedding outfit — 2 wks ago", "12 May"). Action: *New measurement set*. |
| **Measurement entry** | The hero screen in §4. Used for new sets and re-measures. |
| **Set detail (view)** | All items with current values, the set note, images, and a *Re-measure* button. Tap any item to see its history or quick-edit. |
| **Item history** | Timeline of an item's previous values with dates. |
| **Templates** | List, create, and edit templates (ordered items, default unit, optional ranges). |
| **New client** | Name only to create; phone, photo, comment all optional and deferrable. Instant. |

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

## 9. Offline & sync

- Local-first storage; the app is fully usable with no connection.
- Background sync when connectivity returns; image uploads queue separately and retry.
- v1 assumes effectively single-device use per tailor; last-write-wins per item is sufficient. Multi-device conflict handling is deferred.

---

## 10. Starter content (onboarding)

Ship with a small set of editable starter templates so a tailor isn't staring at an empty app on first run. Since templates are general-purpose and the real divergence between them is **sex** (a women's template carries bust and similar items a men's wouldn't), the sensible defaults are a **Men's** and a **Women's** base template, each a reasonable common list of items. The tailor edits these or builds their own from scratch; nothing forces a sex label — it's just the practical organizing logic behind the starting content.

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

1. **Client fields** — name is the only requirement; phone, photo, and a client-level **comment** (general preferences) are optional and deferrable. A client can be created/attached with just a name, before *or* after measuring.
2. **Sets** — no garment-type concept. A client has one or more measurement sets, each with an **optional label**.
3. **Storage** — values stored internally as decimal, displayed/entered as inches-and-quarters.
4. **Soft range validation** — included in v1 (small effort, real accuracy gain).
5. **Sync** — single-device assumption for v1; multi-device deferred.
6. **Starter templates** — Men's and Women's base templates (sex is the natural divergence, e.g. bust), editable; not garment-based.

---

## Next step

The spec is settled. The natural follow-on is a **simple flow + wireframe** of the four screens that carry the experience: Clients → Client detail → Measurement entry → Set detail, with the docked input control (number pad + ¼/½/¾ chips + Next) drawn out in detail.
