# UX redesign: build plan

_Approved designs: [Tailor's Ledger redesign canvas](https://claude.ai/artifact/6bwR2xRAWBgUxGxp9xLMdd) (version 52, 2026-11-05).
Every step names the screens (S-numbers) it builds. Nothing here changes the database._

## How we'll work

- Nine commits, each under about 2,500 changed lines (tests included).
- I stop before every commit with the diff size, the tests and what I checked. You approve each one.
- After each commit I ask whether to bump the patch version.
- You run Metro (`npx expo start`) yourself. I never start it.

## The commits

### 1. The new rules and shared pieces (Design language board)

The docs change first, so code and docs agree:
- `CLAUDE-app.md`:
  - the tabs become Clients · Jobs · Settings;
  - the hero keeps its pad, chips, Next and "+ Add item", and Save moves into the dock beside "X of Y filled".
- Spec §6 and §9a:
  - Client detail gets *Add job*, and Record payment moves to Job detail;
  - New job is its own screen;
  - job items take only a name and a price;
  - jobs show as Still owed or Paid, with a Due date.

Then the shared pieces every screen will use, built but not yet used:
- one header (title + Back);
- the bottom action bar;
- the four button kinds:
  - solid for the main action;
  - a maroon border for focus;
  - plain for everything else;
  - grey underlined text, with red for void and delete;
- the three corner sizes;
- the darker grey and ink colours.

_About 800 lines._

### 2. Tabs and home: S1, S1a, S4, S12

- The tab bar becomes **Clients · Jobs · Settings**.
- **S1 Clients:** search, the "This week" tiles (jobs due, money still owed), and rows showing phone and amount owed.
- **S1a:** one **+** button that opens *New measurement* and *Add client*.
- **S4 Jobs tab** (new): All / Still owed / Paid, grouped into Due this week, Later and No date yet.
- **S12 Templates** moves out of the tabs and opens from Settings, with Back and a bottom *New template* button.

_About 1,800 lines._

### 3. Client detail: S2, S2a

- The header holds the client's name.
- *Call* and *WhatsApp* buttons, plus an "Edit name or phone" link.
- The preferences card.
- Sets and jobs share one section style.
- Only the latest 3 jobs show, then "View all".
- **S2a** lists all of the client's jobs, grouped Still owed and Paid.
- *Add job* and *New measurement* sit at the bottom.

_About 1,000 lines._

### 4. Measuring: S5 (the hero)

- The header holds only Back and "New measurement".
- Buttons under it for **Add client**, **template ▾** and **Add label**, so a set can finally get a name.
- The active row shows "Usually 38–44″".
- A value that looks wrong shows "Check: usually 14–20″".
- The dock's top line holds "7 of 12 filled", a progress bar and a solid **Save set**.
- Next and the chosen chip get the 1px maroon border.
- The tip pop-ups go.
- The pad, the chips, Next in the bottom-right corner, auto-advance and "+ Add item" last all stay exactly as they are.

_About 1,000 lines._

### 5. Set detail and one item: S6, S7

- **S6:** every item in full, each row tapped in one place, a small history count, *Rename*, the note, photos, *Delete this set*, and *Re-measure* at the bottom.
- **S7:** one pop-up with the new value, the item's history, the chips and the pad, with Save in the corner.

_About 1,100 lines._

### 6. New job: S8, S8a

- A full screen with a title, items, a Due date and **Create job** at the bottom.
- Each item takes a name (phone keyboard) and a price.
- Tapping the price, or "Add price", opens the pad (S8a), with **Save** in the corner.
- Nothing is saved until Create job.
- This replaces today's Record payment screen as the way a job starts.

_About 1,500 lines._

### 7. Job detail, payments and receipts: S9, S9a, S9b, S10

- **S9:** the balance card, *Change* and *Rename* links, items, and payments (tap one to open its receipt).
- **S9a:** adding or repricing an item happens in the list, with the pad.
- **S9b:** *Record payment* opens the amount pad in a pop-up, and Save opens the receipt.
- **S10:** *Void* becomes a red underlined link, away from *Share*.

_About 1,400 lines._

### 8. Settings: S11, S11a, S11b, S13

- **S11:** the backup card with *Sign out*, and short groups: Shop, Measuring (Templates, Fraction steps, range warnings) and App (lock). The Text size row and *Show tips again* go.
- **S11a Shop profile:** logo, name, phone, address, receipt footer, next number and currency, saved as you type.
- **S11b Payment details:** bank, account name and number, with a preview of the invoice.
- **S13 Template editor:** all items shown, visible drag handles, "+ Add item" last, the default switch and *Delete this template*.

_About 1,500 lines._

### 9. Motion and clean-up (all screens)

- Pop-ups slide up and lists fade in, both briefly.
- The "filled" count ticks up as you measure.
- A blinking cursor shows where the number pad is typing, everywhere the pad is used:
  - the active row on the measuring screen;
  - the one-item pop-up;
  - a price on New job and Job detail;
  - the payment amount.
- Saving shows a short "Saved".
- Unused code is removed: the tip pop-ups, the old floating + buttons and the old job pop-ups.
- `PROGRESS.md` is updated.

_About 800 lines._

## Technical notes

- **Expo v56:** I'll read the v56 docs before writing code, as `AGENTS.md` asks.
- **No database change:** the schema stays at version 3. Everything new is worked out from data the app already stores:
  - **Money owed and job state:** from item prices and payments. Still owed means a balance above 0.
  - **Due this week:** from `collect_on`.
  - **History counts:** from `measurement_values`.
  - **"Usually …" ranges:** from `template_items`.
  - **The backup card:** from `last_synced_at` and the signed-in account.
- **Job items:**
  - New items get quantity 1 and no link to a measurement set.
  - Old items with a quantity above 1 show their line total with "× 2".
  - The link to a set is kept in the data but not shown.
- **WhatsApp:** phones are stored as typed, so the button adds +234 to local numbers before opening `wa.me`. This gets a unit test.
- **Navigation:**
  - `RecordPaymentScreen` is replaced by a New job screen.
  - Templates and the Shop and Payment screens move into the root stack under Settings.
  - The bottom tabs still never show while measuring.
- **Tests:** keep the history-write rule, soft delete, value formatting and the sync round-trip passing. Add tests for:
  - the new job and balance queries;
  - the WhatsApp number;
  - the hero's Save in the dock.
- **Locked rules unchanged:** offline-first, lazy create, append-only values, money in kobo, receipts voided and never edited.
