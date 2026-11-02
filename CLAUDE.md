# CLAUDE.md: Sortable MVP prototype

Sortable files every document that reaches an independent medical or dental practice and tracks the deadlines inside those documents. This repo holds a **clickable MVP prototype that runs on mock data only**. [PRD.md](PRD.md) is the source of truth for what the product does. This file covers how the prototype is built.

**If the PRD doesn't decide something, ask before building it. Don't guess.** Add each answer to "Decisions already made" below.

## MVP rules

1. **Opens by double-clicking `index.html`.** It runs from `file://` in current Chrome, Safari and Firefox, with no server, no build step and no installs.
2. **No framework, no libraries, no CDN.** Use plain HTML, CSS and JavaScript only. The app must work offline.
   - Font files stored in `assets/fonts/` are allowed.
   - Nothing is ever loaded from the network.
3. **Use classic `<script>` tags only.** ES modules (`type="module"`), `fetch`, XHR and `.json` files all fail on `file://`. Mock data is a `.js` file that sets a global. Every file attaches to the single namespace `window.Sortable`.
4. **Mock data only.** No network calls, no backend, no real AI, no API keys and no real email or fax. Anything "AI" does comes from scripted results in the mock data.
5. **State lives in memory and resets on reload.** Do not use localStorage, sessionStorage or cookies. On load the app deep-copies `MOCK`, so the seed is never changed. Dropped files are lost on reload too.
6. **"Today" is fixed.** All business logic uses `Sortable.util.today()` (which returns `MOCK.today`), never `new Date()`, so deadlines and overdue states look the same in every demo.
7. **Dropped files are kept, never parsed.**
   - **Kept:** a dropped file is held in memory as an object URL, only so it can be previewed and downloaded.
   - **Never parsed:** its contents are never read. Classification uses only `file.name`.
   - **Sample documents** have no real file. They preview as a drawn mock built from their fields.
8. **Only `js/store.js` changes state.** Views call the store functions listed in "Module APIs". Views never edit data directly.
9. **Escape every piece of data** that goes into `innerHTML` (use `Sortable.util.esc`).
10. **Only build what the PRD puts in scope** (R1–R12) plus the extras in "Decisions already made". Nothing else.
11. **Stay in your own files.** Each file has one owner (see File layout). If your work needs a change in someone else's file, ask that owner.
12. **Styles live in two places.**
    - **Shared:** tokens, fonts, the class kit and the `Sortable.ui` components' styles live in `css/styles.css`, which belongs to Design.
    - **Per screen:** each screen owns `css/<screen>.css` for styles only that screen uses. Its `render` sets `root.className = "page screen-<name>"`, and every rule in its CSS file starts with `.screen-<name>`.
    - **Restrictions:** screen CSS uses the tokens (`var(--primary)` and so on), with no new colors and no fonts. No inline styles anywhere, except the ring's `--p` and `--fill` custom properties, which `ui.ring` sets.
    - **Shared changes go to Design:** if something belongs in the shared kit, ask the Design owner.
13. **Works at phone width.** Every screen works at 375px wide with no sideways scrolling, as well as on a laptop.
    - Tables scroll inside their card, never the whole page. The Files list may be 900px wide inside its card.
    - On phones, the Files sidebar becomes a drawer, and the details panel and previews become a full-screen sheet.
14. **Listeners.** Views attach event listeners only to elements they create, never to `document` or `window`. The one exception is `js/ui.js`: while a menu, modal or drag overlay is open, it may listen on `document`, and it removes those listeners when the menu, modal or overlay closes.

## Hard product rules (from the PRD)

These rules hold no matter how the code changes.

1. **Nothing is filed silently when the AI is unsure.** A document with confidence below **0.85** goes to the review queue and never into a folder (R4).
2. **Approve or fix takes one click** from the review queue (R4).
   - **Approve** files the document as the AI suggested.
   - **Fix** shows the document's `alternatives` as buttons. There are up to 3, each labelled with its folder path, such as `Invoices › Medline`. Clicking one files the document there.
   - **Something else…** opens the details form (employee, document type, document date, expiration) so the details can be set by hand.
   - **Move** (on a filed document) opens the folder picker.
3. **Every filed document is named `Type – Employee or Vendor – YYYY-MM-DD`**, for example `Invoice – Henry Schein – 2026-03-12` (R3).
   - **Type** is the type label: Invoice, License, Certification, Training, HR form, Contract, Compliance, Medical record, Document (for `other`).
   - **The middle slot** is the employee's name if there is one, otherwise the vendor's name, otherwise `Practice`.
   - **The date** is `docDate`.
   - A document still being read or in review shows its `filename`.
   - If the user renames a document, their name is kept, and later corrections don't overwrite it.
4. **Folders are created automatically** from each document's details. The tree is:

   ```
   All files
   ├─ Employees
   │   └─ {Department}                      Providers, Clinical staff, Front desk, Billing, Administration
   │       └─ {Last, First}                  one per employee, all 40 always exist
   │           ├─ Licenses                   license
   │           ├─ Certifications             certification
   │           ├─ Trainings                  training
   │           └─ HR forms                   hr_form
   ├─ Practice documents
   │   ├─ Invoices
   │   │   └─ {Vendor}                       invoice
   │   ├─ Vendors
   │   │   └─ {Vendor}                       contract, and other documents with a vendor
   │   └─ Compliance
   │       └─ {OSHA | HIPAA | Inspection | Renewal}   compliance, by topic
   └─ Confidential Medical                   restricted
       └─ {Last, First}                      medical
   ```

   - **Created on demand:** the type folders under a person, and the vendor and topic folders, appear when their first document is filed.
   - **Always there:** department and person folders always exist.
   - **Where unmatched documents go:**
     - an `other` document with an employee files in the person's folder
     - one with neither an employee nor a vendor files in Practice documents
     - a compliance document with no topic files in Compliance
   - **User folders:** "+ New folder" creates a folder anywhere except inside Confidential Medical. Documents moved into a user folder stay there until moved again.
   - **Locked folders:** automatic folders can't be renamed, moved or deleted. User folders can be deleted only when they're empty.
   - **On demand inside Confidential Medical:** person folders there are created when that person's first medical record arrives.
   - **Credentials with no employee:** they file in Employees.
5. **Employees are browsed inside Files** (R9).
   - Opening Employees shows people grouped by department.
   - An **A–Z** toggle lists all 40 person folders in one alphabetical list (by last name).
6. **Every deadline has a status of `upcoming`, `overdue`, `awaiting` or `done`.** Status is worked out from the deadline date, `requestedOn`, `closedOn` and today. It is never stored.
   - **done:** the deadline is closed. An invoice is paid, a credential is replaced by a newer document, or a compliance item is resolved.
   - **awaiting:** a new document has been requested (`requestedOn` is set) but hasn't arrived. The screen label is **Needs new document**. An awaiting item is never overdue.
   - **Otherwise:** **overdue** if its date is before today, **upcoming** if not.
   - **Invoices** show their status as **unpaid**, **paid** or **overdue** (R6).
   - **Soon:** an upcoming item is **soon** when it is inside its first reminder window (7 days for invoices, 60 days for credentials and compliance items).
   - **Missing due date:** an invoice with no `dueDate` creates no deadline and shows "Due date missing".
   - **Copies:** made with "Make a copy", they create no deadlines.
7. **Reminders follow fixed schedules:**
   - invoices: 7 and 1 days before the due date (R7)
   - licenses, certifications, trainings and compliance items: 60, 30 and 7 days before (R8, R12)
   - **awaiting** credentials: a weekly reminder on `requestedOn + 7`, `+ 14` and so on, until the new document arrives. Before-due reminders stop on `requestedOn`.

   No before-due reminders are sent on or after the due date. When an item is closed, its future reminders disappear. Reminders sent before it was closed stay in the outbox. No real email is sent.
8. **A newer credential replaces the old one.** "Credential" means a license, certification or training.
   - **Automatic:** when a credential is filed for an employee who already has an open credential of the same type with an earlier `expiresOn`, the old one gets `renewedOn = today` and its deadline is done. This happens whenever a document becomes `filed`.
   - **By hand:** **Mark as renewed** and **Request updated version** set `requestedOn = today`, which puts the item in Needs new document. The item closes only when the newer document is filed.
9. **Search is forgiving and works offline** (R5). See "How search works".
   - It searches filed documents (not ones being read, in review or in the trash) and folders.
   - "Henry Schein March" must return `Invoice – Henry Schein – 2026-03-12` first.
10. **Out of scope. Do not build any of these:**
    - insurance billing, claims or appeals
    - e-signature
    - scheduling, time clock or payroll
    - performance reviews or concern reporting
    - integrations (Dentrix, OMSVision, QuickBooks, Weave, Paychex)
    - onboarding checklists
    - real logins, real access control or a real storage connection (Confidential Medical access and "Where files live" are mocks)
11. **All people in the mock data are made up.** Never use real names or real personal data. Real vendor names (Henry Schein, Medline, McKesson) are fine.
12. **Write for a busy, non-technical practice manager.** Use plain words, no jargon, and show at most one main action per row.

## Decisions already made

These were decided with Kate on 2026-10-21 and 2026-10-28, to fill gaps in the PRD.

| Topic | Decision |
|---|---|
| Mock practice | Specialty medical practice, 40 staff, one location ("Main office") |
| Departments | Providers (physician, nurse practitioner, physician assistant). Clinical staff (registered nurse, medical assistant, radiology technician, lab technician). Front desk (front desk, front desk lead, scheduler). Billing (billing specialist). Administration (office manager, IT coordinator, facilities) |
| Review threshold | Confidence below 0.85 goes to review |
| Alert lead times | Invoices: 7 and 1 days. Credentials and compliance: 60, 30 and 7 days. Needs new document: every 7 days |
| Overdue | No before-due reminders after the due date. Overdue items show in red |
| Intake | "Send a test document" (Today) and "Simulate incoming" (Inbox) take the next item from `MOCK.incoming`. Dropped or chosen files are classified by filename. A file with no match goes to review at confidence 0.40 |
| Being read | A new document spends 1.5 seconds as `reading` ("Being read now"), then files or goes to review. `store.settleAll()` skips the wait |
| Fix | Up to 3 alternative buttons labelled with folder paths, plus "Something else…" |
| Renewal | A newer credential replaces the old one automatically. "Mark as renewed" and "Request updated version" mean Needs new document until it arrives |
| Learning | Only corrections teach a rule: a Fix, "Something else…" from review, or a Move into an automatic folder. Approve does not, and nor does a Move into a user folder |
| Previews | Sample documents show a drawn mock. A dropped PDF or image shows the real file. Other dropped files (such as Word) show the mock |
| Download | A dropped file downloads itself. A sample document downloads a `.txt` summary of its details |
| Persistence | None. A reload restores the seed |
| Today | Fixed at `MOCK.today` = 2026-10-21 |
| Reminder outbox | Shown on Today, newest first, 20 rows. It lists the reminders sent by today, and the next one scheduled for each open item |
| Search | Offline, AI-like matching (see "How search works"). No real AI |
| Money | US dollars, shown as `$1,234.56` |
| Starting state | 3 documents in review and 5 items in the incoming queue. The calendar opens on today's month |
| Confidential Medical | Restricted to the office manager (Orrin Szabo, `emp-16`) and the medical director (Marisol Vance, `emp-01`). With no logins, the viewer is always "You (office manager)", so it opens. "Manage access" is a mock modal listing those two people |
| Where files live | "Sortable cloud", seeded as connected. Setup has a "Simulate a connection problem" switch, which turns on the alert strips |
| Location | Every document's location is "Main office". The Location filter is hidden while there is one location |
| Activity | Every change is logged on the document. "Who" is "Sortable" for automatic steps and "You" for anything the user does |
| Setup (R11) | The forwarding email, e-fax number, practice details, and the "Where files live" screen |
| Navigation | Four tabs: Today, Inbox, Files, Deadlines. Employees live in Files. The header search box opens the Search page |
| Brand | The notes' look: blue OKLCH palette, Schibsted Grotesk and JetBrains Mono, 14px cards and pill controls (see "Design tokens and class kit") |
| File owners | Owners are role placeholders. The team assigns names later |

## Navigation

Every screen has the same header: the sorted-bars logo and the `sortable` wordmark, then four tabs, a search box, and a ⚙ icon that opens Setup. The header lives in `index.html`, which the Shell owner owns. Pressing Enter in the search box goes to `#/search?q=<query>`.

```
[≡ sortable]  Today | Inbox (3) | Files | Deadlines    [ Search… ]  ⚙
```

The app uses hash routing (this works on `file://`), and the browser Back button must work.
- **Unknown route:** goes to `#/dashboard`, and so does a malformed one such as `#/library/x`.
- **Unknown ID:** an ID that doesn't exist, such as `#/doc/doc-999`, shows a "Not found" empty state.
- **Active tab:**
  - `#/library` and `#/doc` highlight Files.
  - `#/search` highlights no tab.
  - `#/deadlines` highlights Deadlines.
  - `#/setup` highlights the ⚙ link.

| Route | View file | Screen |
|---|---|---|
| `#/dashboard` (default) | `dashboard` | **Today** (see "Today page") |
| `#/inbox` | `inbox` | Forwarding and drop strip, "Simulate incoming", "Being read now", and the review queue with preview, Approve and Fix |
| `#/library` | `library` | Files: All files |
| `#/library/f/:folderId` | `library` | Files: one folder. The Employees folder has the department / A–Z toggle (`?az=1`) |
| `#/library/c/:collection` | `library` | Files: `recent`, `starred`, `expiring`, `review` or `trash` |
| `#/doc/:id` | `library` | Files at the document's folder, with that document selected and the details panel open |
| `#/search?q=` | `search` | Search page |
| `#/deadlines` | `deadlines` | Deadline list, grouped by `?group=category` (default), `vendor` or `due`. List / Calendar toggle |
| `#/deadlines/calendar` | `deadlines` | Month calendar of every open deadline. Opens on today's month, with ‹ › arrows |
| `#/setup` | `setup` | Forwarding email, e-fax number, practice details, and "Where files live" with its connection status and the problem switch |
| `#/employees`, `#/employees/:id` | (redirect) | Go to `#/library/f/fld-employees` and `#/library/f/fld-emp-XX` |

Files screens also keep their view settings in the query string, so a redraw keeps them: `view=list|grid`, `sort=`, `dir=`, `employee=`, `type=`, `status=`, `q=` and `az=`.

### Today page (top to bottom)

1. **Heading:** the date (`formatDate(today)`, 14px muted) above the H1 "Today". A primary **Send a test document** button sits on the right.
2. **Alert strip:** shown only when `storage().status` isn't `connected`. Clicking it opens `#/setup`.
3. **Forwarding strip:** `ui.dropZone()`.
4. **Three ring cards** (each a button), using `store.metrics()`:
   - **Filed and complete:** "X of Y documents filed". Opens `#/library`.
   - **To review or pending:** the label shows the open %. The ring fill and color use the completion %. Legend: "To review: n", "Pending: n". Opens `#/inbox`.
   - **Expirations to attend to:** "X of Y tracked dates need attention". Legend: "Expired: n", "Within 30 days: n". Opens `#/library/c/expiring`.
5. **Expiring in 30 days card:**
   - a big count, colored per "Date colors"
   - "See all expirations"
   - the next 3 expirations, each with a calendar block (3-letter month over the day), the person's name and "Doc type · in N days"
6. **Three lanes:**
   - **Received** ("Being read now", with shimmer text "Finding the employee, type, and dates…")
   - **Filed** ("Named and put away. Nothing to do.", documents filed today, with path and how they were filed)
   - **Needs you** (`store.needsYou()`, the reason in bold, the filename in mono, opens Inbox)

   Empty states: "Nothing arriving right now" and "All caught up".
7. **Reminder outbox:** at most 20 sent rows, plus the next reminders.

### Files screen

- **Sidebar** (sticky):
  - **+ New** opens a menu: New folder, Upload files, Upload folder, Copy forwarding email.
  - **Collections:** All files, Employees, Practice documents. Then, after a gap: Recent, Starred, Expiring soon (count), Needs review (count), Confidential Medical (lock icon), Trash.
  - **"Where files live" card:** shows the storage name, a sub line and a status dot. It opens `#/setup`.
- **Toolbar:**
  - **Search field:** scoped to the current folder and below, using `search.run(q, { minShare: 0.5, folderId })`, with Clear.
  - **Alert strip:** when storage needs attention.
  - **Breadcrumbs:** the current crumb is larger and bold, and every crumb is clickable.
  - **Filter pills:** Employee, Document type, Status, with "Clear filters". Location is hidden while there is one location.
  - **Sort:** Name, Last modified, Expiration date, Document type.
  - **List | Grid** toggle.
  - **Confidential Medical:** shows the red-tinted restricted banner with "Manage access".
- **Bulk bar:** shown once anything is selected. "N selected · Move · Download · Rename (one item only) · Request updated versions · Delete · Clear".
- **List view:**
  - **Columns:** checkbox | Name (icon, name, sub line, lock) | Employee | Document type | Last modified | Expiration date | Status | ⋯.
  - **Sorting:** the Name, Document type, Last modified and Expiration headers sort the list.
  - **Default order:** by status: Current, Expiring soon, Needs review, Needs new document, Expired, then the rest.
- **Grid view:**
  - **Folders section:** compact cards.
  - **Files section:** cards with a 150px `ui.docMock`, a checkbox, an extension icon, the name, ⋯, the employee and a status tag.
- **Interactions:**
  - **Click:** selects an item and opens the details panel (`#/doc/:id`). Double-clicking a folder opens it.
  - **Menu:** right-click or ⋯ opens the context menu.
    - Files: Open, Preview, Download | Rename, Move, Make a copy, Star | Request updated version, View details | Delete.
    - Folders: Open, Rename, Move, Star, Delete.
    - Trash: Restore, Delete forever.
  - **Inline rename:** Enter or leaving the field saves, Esc cancels.
  - **Drag to move:** drag a file onto a folder to move it.
  - **Dropping files from the computer:** shows the overlay "Drop to upload to {folder}" and "Sortable will read each file and file it in the right place". The files go through `store.receive`.
  - **Toasts:** confirm each action.
  - **Empty states:** a dashed card, with "Upload files" and "Copy forwarding email" where they fit.
- **Details panel:** `ui.detailsPanel`, about 380px wide and sticky, or a full-screen sheet on phones.

### Search page

- **Layout:** centered. The H1 is "Find any document".
- **Input:** a big pill input (autofocus) with the placeholder "Okafor's license".
- **Suggestion chips:** "Okafor's license", "Henry Schein March", "HIPAA training", "Medline invoice", "Priya's certification".
- **Results:**
  - Folder matches come first, as a compact row.
  - Then up to 6 document cards: "Employee or Vendor · Doc type", the name in mono, and "Folder › path · Expires date".
  - The top hit gets a "Best match" pill.
- **No results** (for a query longer than 2 characters): "No documents match. Try a name, a document type, or a folder."

## Module APIs

Every builder codes against these functions. Change a signature only with the file's owner, and update this section in the same change. Every function that takes `ids` also accepts a single ID.

**`Sortable.util`** (`js/util.js`)

Dates:
- `today()` returns `MOCK.today`.
- `addDays(date, n)` returns a date string.
- `daysBetween(a, b)` returns `b − a` in whole days.
- `daysFromToday(date)` returns `daysBetween(today(), date)`.
- `relativeDays(date)` returns "today", "tomorrow", "in N days", "yesterday" or "N days ago".
- `monthIndex(word)` returns 1–12 for a month name or its 3-letter short form, otherwise `null`.
- `formatDate(date)` returns `"Mar 12, 2026"`.
- `monthDay(date)` returns `{ mon: "MAR", day: "12" }`.

Formatting:
- `formatMoney(cents)` returns `"$1,234.56"`.
- `esc(text)` escapes text for HTML.
- `typeLabel(type)` returns the display label from hard rule 3.
- `fileExt(filename)` returns the extension, lowercased (`"pdf"`), or `"file"`.

IDs:
- `nextId(prefix, list)` returns the next ID with that prefix (`"doc-048"`). `doc` IDs are padded to 3 digits and all others to 2.

**`Sortable.store`** (`js/store.js`)

Setup:
- `init()` deep-copies `MOCK` into state, builds the folder tree, and writes the starting activity for seed documents.

Reads (all return deep copies):

*Practice and people*
- `practice()`, `viewer()`, `storage()`
- `departments()`
- `employees()` and `employee(id)`
- `vendors()` and `vendor(id)`

*Documents*
- `documents(filter)`, where `filter` is `{ status, category, type, employeeId, vendorId, folderId, recursive, starred, trashed }`. Every key is optional. Trashed documents are left out, and `trashed: true` returns only trashed ones.
- `copy(id)` names the copy "Copy of …". A review document with no rule match has `suggested: null`.
- Awaiting credentials count only as Pending in `metrics()`, never as expired or within 30 days.
- `document(id)`

*Folders*
- `folders()` and `folder(id)`
- `children(folderId)` returns `{ folders, documents }` directly inside a folder. `null` means All files.
- `pathOf(folderId)` returns `[{ id, name }]` from the top level down.
- `folderFor(result)` returns the folder ID a classification result files into, even if that folder doesn't exist yet.
- `pathLabel(result)` returns, for example, `"Invoices › Medline"` (the path below Practice documents or Employees).
- `canOpen(folderId)` returns true or false. It is always true for the viewer.

*Collections and queues*
- `collection(name)` returns documents for `recent` (modified in the last 14 days, newest first), `starred`, `expiring` (credentials 0–30 days out), `review` or `trash`.
- `collectionCounts()`
- `reviewQueue()`
- `received()` returns documents in `reading`.
- `filedToday()`
- `needsYou()` returns `[{ docId, filename, reason }]`. The reason is one of "Couldn't tell what this is", "Not sure (70% confident)" or "Needs new document".

*Status, deadlines and metrics*
- `compliance()`
- `rules()` returns the learned rules first, then the seed rules.
- `incomingCount()`
- `invoiceStatus(doc)` returns `"unpaid"`, `"paid"` or `"overdue"`.
- `fileStatus(doc)` returns `{ key, label }`. The key is one of `reading`, `review`, `awaiting`, `expired`, `expiring`, `current`, `renewed`, `unpaid`, `paid` or `overdue`.
  - Credentials: expired if `expiresOn` is before today, expiring if 30 days or fewer, otherwise current.
  - Credentials with `renewedOn` are renewed, and those with `requestedOn` are awaiting.
  - Invoices use `invoiceStatus`.
  - Anything else filed is current.
- `deadlines()` returns:

  ```js
  { id: "invoice:doc-012", kind, title, dueOn,
    status,            // "upcoming" | "overdue" | "awaiting" | "done"
    soon, refId, employeeId, vendorId, requestedOn, closedOn }
  ```

- `metrics()` returns (percentages are whole numbers, rounded):

  ```js
  { filed:       { count, total, pct },                    // filed ÷ all non-trashed documents
    open:        { review, pending, count, total, openPct, completionPct },
                 // pending = awaiting credentials; openPct = (review + pending) ÷ total
    expirations: { expired, within30, attention, tracked, completionPct },
                 // tracked = filed, open credentials with expiresOn; attention = expired + within30
    expiring30:  { count, worst: "red" | "amber" | "green", next: [{ docId, employeeId, type, expiresOn, days }] } }
  ```

*Files*
- `fileUrl(id)` returns the dropped file's object URL, or `null`.

Writes (each one notifies subscribers and logs activity):

*Intake and review*
- `receive(input)` creates a `reading` document and returns it. `input` is `{ channel, sender, filename, text, fields, file }`, where `file` is an optional `File`.
- `nextIncoming()` returns `null` when the queue is empty.
- `settleAll()` finishes every `reading` document now.
- `approve(id)` returns `null` when there's no suggestion.
- `correct(id, result)` reclassifies the document, moves it to `folderFor(result)` and learns a rule.
- `editDetails(id, { employeeId, type, docDate, expiresOn })` reclassifies the document. On a review document it counts as a correction.

*Organizing*
- `move(ids, folderId)` moves documents or user folders. Moving into an automatic folder reclassifies (and learns). Moving into a user folder only changes location.
- `rename(id, name)` renames a document or a user folder.
- `copy(id)`
- `star(ids, on)`
- `newFolder(parentId, name)` returns the new folder.
- `deleteFolder(id)` works for empty user folders only, and returns false otherwise.

*Trash*
- `trash(ids)`
- `restore(ids)`
- `deleteForever(ids)` also releases the object URL.

*Deadlines*
- `markPaid(id)`
- `markRenewed(id)` and `requestUpdate(ids)` both set `requestedOn` on credentials.
- `resolveCompliance(id)`
- These all accept a plain ID or a deadline ID.

*Other*
- `setStorageStatus("connected" | "attention" | "offline")`

Subscribing:
- `subscribe(fn)`

**`Sortable.ai`** (`js/ai-mock.js`)
- `classify(input, rules)` returns `{ result, confidence, alternatives, fields }`. `result` is `{ type, employeeId, vendorId, topic }`.
- `matchKey(input)`, `ruleFromCorrection(doc, result)` and `nameFor(doc)` are unchanged.

**`Sortable.search`** (`js/search.js`)
- `run(query, opts)` returns `{ documents, folders }`, both ranked.
- `opts` is `{ filters: { type, employeeId, vendorId, status, from, to }, folderId, minShare }`. `minShare` defaults to 0, so a document needs 1 matching word. The Files toolbar passes 0.5.
- `words(query)` returns the cleaned query words, with repeats removed, so screens can show what was searched.
- **No usable words:** a query that's empty, or only stop words, returns no documents and no folders. Screens that list or filter with no query use `store.children` and `store.documents`, not `search.run`.
- **Dates:** month and year words count as weak words, scoring 1.
- **Folder scope:** with `folderId`, matching folders are the ones below it, not the folder itself. Folders at the same depth keep their tree order.

**`Sortable.reminders`** (`js/reminders.js`)
- `schedule(deadline)` returns `[{ sendOn, kind: "before" | "weekly", offsetDays, week }]`, earliest first. Weekly reminders run up to the first one after today.
- `outbox()` returns `{ sent, next }`. Each row is `{ deadlineId, title, sendOn, kind, offsetDays, week }`.
  - `sent` is newest first. A reminder counts as sent if `sendOn` is on or before today, and on or before `closedOn` if the item is closed.
  - `next` is soonest first, one per open item.
  - **Weekly rows:** they have `offsetDays: null`, and before-due rows have `week: null`.
  - **Request day:** a before-due reminder that falls on `requestedOn` still counts.
  - **Shared dates:** when a before-due and a weekly reminder share a date, the before-due one sorts first.
  - **After the due date:** weekly reminders continue, because an awaiting item is never overdue.

**`Sortable.ui`** (`js/ui.js`): shared components. Each returns a DOM element unless noted.
- `fileIcon(ext)`: the extension in a small rounded rectangle. `"folder"` gives the folder shape.
- `statusTag(statusKey)`
- `expiryText(date)`: text colored per "Date colors".
- `calBlock(date)`: the month and day block.
- `ring(labelPct, fillPct)`: the donut. The label is in neutral ink, and the fill color comes from `fillPct` (see "Ring colors").
- `docMock(doc, size)`: `size` is `"card"`, `"panel"` or `"full"`. It shows the real file for PDFs and images that have a `fileUrl`. Otherwise it draws the mock: practice name, type, employee, grey lines, expiry. Photo extensions with no file show a striped placeholder.
- `dropZone()`: the dashed strip. "Forward to `{forwardEmail}`" (mono, blue) with **Copy**, "or drop PDFs, scans, and Word files here", and a "Choose files" button. It calls `store.receive` with each file attached, shows a short progress bar, and toasts.
- `detailsPanel(docId, { onClose })`:
  - Header and preview. Clicking the preview opens it full size.
  - Buttons: Open full size, Download, Edit details, and Request updated version (credentials only).
  - A "Sortable details" grid: Employee, Document type, Document date, Expires, Label, Filed, Location.
  - Edit mode, which calls `store.editDetails`.
  - The activity timeline.
- `folderPicker(onPick)`: the folder tree, for Move.

Functions that return nothing:
- `menu(items, x, y)`: the context menu, kept inside the viewport. Each item is `{ label, onSelect, danger, disabled }` or `{ divider: true }`.
- `modal({ title, body, actions })` returns a `close()` function.
- `toast(text)`
- `download(docId)`
- `copyText(text, button)`: uses the clipboard, with a select-text fallback, and shows feedback on the button.

**Views and rendering**
- Each view registers itself as `Sortable.views.<name> = { render(root, params) }`.
- `params` is `{ segments, query }`.
- On every route change, and after every store write, the router clears `<main id="view">`, gives the view a fresh `root` element and re-renders. It also updates the Inbox badge.
- Views keep transient state (selection, open menus, the calendar month) in variables in their own file, so a redraw keeps it.

## How search works

1. **Clean the query.**
   - Lowercase it.
   - Remove `'s` and `’s`.
   - Turn everything that isn't a letter or digit into a space.
   - Split it into words.
   - Drop 1-character words and stop words: the, a, an, of, for, my, our, to, in, on, and, or, with, from, by, at, is, me, show, find, all.
2. **Expand synonyms.** Each word also matches its synonyms:
   - cpr ↔ bls
   - license ↔ licence
   - invoice ↔ bill ↔ statement
   - insurance ↔ malpractice
   - dea → registration
   - tax ↔ w4 ↔ w9
   - handbook → policy
   - vaccine ↔ vaccination ↔ immunization
   - flu ↔ influenza
   - fire → inspection
3. **Build each document's words.**
   - **Strong words:** name, employee name, vendor name, and folder path names.
   - **Weak words:** filename, type label, category, topic, department and `text`.
   - **Dates:** the full and short month name of `docDate`, and its 4-digit year.
4. **Match.** A query word matches if it, or one of its synonyms, is the start of any document word.
5. **Score.**
   - A matching word scores 2 if it matched a strong word, otherwise 1.
   - A document is kept when its number of matched words is at least 1, and at least `ceil(minShare × words)`.
   - Sort by matched words, then score, then newest `docDate`, then higher ID.
6. **Folders.** A folder matches when every query word matches its path names. Folders are sorted by depth, deepest first, and at most 4 are returned.
7. **Exclusions.** Search never returns documents that are `reading`, in `review` or trashed.

## Data contract

`data/mock-data.js` sets `window.MOCK`. This is the only seed data. Field names and types below are a contract: change them only with the Data owner, and update this section in the same change.

General conventions:

- Dates are `"YYYY-MM-DD"` strings with no times or time zones.
- Money is integer cents.
- IDs are a prefix plus a zero-padded number: `emp-01`, `ven-01`, `doc-001`, `cmp-01`, `in-01`, `rule-01`, `fld-u-01`.

```js
window.MOCK = {
  today: "2026-10-21",
  practice: { name, specialty, staffCount: 40, forwardEmail, faxNumber, locations: ["Main office"] },
  viewer:   { employeeId: "emp-16", label: "You (office manager)" },
  storage:  { name: "Sortable cloud", sub: "Encrypted, backed up nightly", status: "connected" },
  departments: [ { id: "dept-providers", name: "Providers" }, ... ],   // the 5 departments, in this order

  employees: [ { id: "emp-01", name, role, departmentId, startDate } ],   // exactly 40 people, all made up
  vendors:   [ { id: "ven-01", name, category } ],

  documents: [ {
    id: "doc-001",
    filename,             // original file name; ext = util.fileExt(filename)
    name,                 // see hard rule 3
    renamed,              // true once the user renames it
    type,                 // "invoice" | "license" | "certification" | "training" | "hr_form"
                          // | "contract" | "compliance" | "medical" | "other"
    topic,                // compliance only: "OSHA" | "HIPAA" | "Inspection" | "Renewal". Otherwise null
    folderId,             // set by the store; null while reading or in review
    status,               // "reading" | "review" | "filed"
    confidence, alternatives, suggested,   // suggested: the classify result while in review, otherwise null
    matchKey, channel, sender,
    receivedOn, modifiedOn, docDate,
    employeeId, vendorId, text,
    invoice,              // invoices only: { amountCents, dueDate, paidOn }
    expiresOn, renewedOn, requestedOn,     // credentials only
    filedBy,              // "auto" | "reviewed" | "manual". Null until filed
    location,             // "Main office"
    starred, deletedOn, copyOf, hasFile,
    activity              // [{ on, what, detail, who }]. The store writes the seed documents' starting events
  } ],

  folders: [],            // user folders only: { id: "fld-u-01", name, parentId }. The store builds the automatic ones

  compliance: [ { id: "cmp-01", title, category, dueOn, resolvedOn, documentId } ],
  incoming:   [ { id: "in-01", channel, sender, filename, text, fields: { docDate, amountCents, dueDate, expiresOn } } ],
  filingRules: [ { id: "rule-01", match, confidence,
                   result: { type, employeeId, vendorId, topic },
                   alternatives: [ result, ... ],
                   fields: { amountCents, dueInDays, expiresInDays } } ]
};
```

**Folder records** (built by the store) are `{ id, name, parentId, kind, restricted, starred, auto }`. `kind` is one of `section`, `group`, `department`, `person`, `doctype`, `vendor`, `topic` or `user`. The automatic folder IDs are fixed, so tests and links can use them:

| Folder | ID |
|---|---|
| Employees | `fld-employees` |
| Practice documents | `fld-practice` |
| Confidential Medical | `fld-confidential` (restricted) |
| Invoices / Vendors / Compliance | `fld-invoices` / `fld-vendors` / `fld-compliance` |
| A department | `fld-dept-providers`, `fld-dept-clinical`, `fld-dept-front`, `fld-dept-billing`, `fld-dept-admin` |
| A person | `fld-emp-07` |
| A person's type folder | `fld-emp-07-licenses`, `-certifications`, `-trainings`, `-hr` |
| A vendor's invoices / documents | `fld-inv-ven-02` / `fld-ven-ven-02` |
| A compliance topic | `fld-cmp-osha`, `fld-cmp-hipaa`, `fld-cmp-inspection`, `fld-cmp-renewal` |
| A person's medical records | `fld-conf-emp-07` |

A person folder's name is "Last, First": the last word of the employee's name, a comma, then the rest.

`category` (worked out, never stored) is one of Invoices, Licenses (all credentials), HR, Vendors, Compliance, Confidential or Practice.

### How classification works

1. **Match a rule.** Build the match text: `(sender + " " + filename)`, lowercased. The first rule in `store.rules()` whose `match` is a substring of that text wins.
2. **No match.** If no rule matches, the document goes to review with `confidence: 0.40`, a result of type `other` with nothing linked, and no alternatives. Approve then does nothing, and Fix shows only "Something else…".
3. **Fill in the fields.** `docDate` comes from the input's `fields`, else a date in the filename (`YYYY-MM-DD` or `YYYYMMDD`), else today. `receivedOn` and `modifiedOn` are today. This happens only in `ai-mock.js`; the store doesn't repeat it.
4. **Fill in amounts and dates.** These come from the input's `fields` first, else the rule's relative `fields` (`dueDate = docDate + dueInDays`, `expiresOn = docDate + expiresInDays`). If neither has them, they are null.
5. **Settle.** After 1.5 seconds (or `settleAll()`), a document with confidence 0.85 or higher files into `folderFor(result)` with `filedBy: "auto"`. Otherwise it goes to review with `suggested` set.

### Learning from corrections

Each correction adds a learned rule:

```js
{ id: nextId("rule"), match: doc.matchKey, confidence: 0.95, result: <the corrected result>, alternatives: [] }
```

- Learned rules go before all seed rules, newest first. They live in memory only.
- **Learning key:** for email and fax, the key is the lowercased `sender`. For uploads, it is the filename, lowercased, with the extension removed, cut off at the first digit, and with trailing `_ - . ` and spaces trimmed.
- **Short keys:** a key shorter than 6 characters learns nothing.

### Values that are always worked out, never stored

- invoice, deadline and file status
- `category`
- the deadline list, reminders and outbox
- metrics, collections, counts and search results

### Fixtures the seed must include

| Fixture | Exact seed |
|---|---|
| Henry Schein March invoice | A filed, paid `Invoice – Henry Schein – 2026-03-12`. It is the only Henry Schein document dated in March |
| Invoice due in 7 days | An unpaid invoice with `dueDate` 2026-10-28 |
| Invoice due in 1 day | An unpaid invoice with `dueDate` 2026-10-22 |
| Overdue invoice | An unpaid invoice with `dueDate` before 2026-10-21 |
| Expiring certification | A certification for `emp-03` (Priya Ramaswamy) with `expiresOn` 2026-12-05. No check renews it |
| License to be replaced | A license for `emp-07` (Adaeze Okafor) with `expiresOn` 2026-11-10 |
| Awaiting training | A training for `emp-09` with `expiresOn` 2026-11-30 and `requestedOn` 2026-10-07. Its weekly reminders were sent 10-14 and 10-21, and the next is 10-28 |
| Expiring within 10 days | One credential with `expiresOn` between 2026-10-22 and 2026-10-31, so "Expiring in 30 days" shows red |
| Text-only search word | A filed compliance document (topic Inspection) whose `text` contains "autoclave" and whose name, filename and folders don't |
| Confidential Medical | At least 3 `medical` documents for at least 2 employees |
| Starred and trash | 2 starred documents, and 1 trashed document (`deletedOn` 2026-10-18) |
| License renewal upload rule | `match: "license_renewal_okafor"`, confidence 0.92, result `{ type: "license", employeeId: "emp-07" }`, `fields: { expiresInDays: 730 }` |
| `in-01` | Email from `ap@henryschein.com`, `HenrySchein_Invoice_Oct.pdf`, with `docDate` 2026-10-20, an amount and `dueDate` 2026-11-19. It matches a `henryschein.com` rule at 0.96 |
| `in-02` | Fax from `+1 555 0142`, `fax_0142.pdf`, with no rule match → review at 0.40 |
| `in-03` | Email from `billing@medline.com`, `Medline_statement_Oct.pdf`. It matches a `medline.com` rule at 0.70 that wrongly suggests a Medline contract. The first alternative is an invoice / Medline |
| `in-04` | Email from `billing@medline.com`, `Medline_statement_Nov.pdf`. After `in-03` is fixed, it files as an invoice with no review |
| `in-05` | Email from `orders@mckesson.com`, `McKesson_Invoice_1021.pdf`, with an amount and `dueDate` 2026-11-20. It matches a `mckesson.com` rule at 0.94 → invoice / `ven-07` (McKesson). `ven-07` has no documents before this, so `fld-inv-ven-07` doesn't exist until it arrives |
| Seeded review items | 3 documents in review, each with `suggested` and alternatives |
| Seed size | Exactly 40 employees, each with a `departmentId`, at least 10 with documents. At least 7 vendors. At least 35 filed documents covering every category. At least 8 invoices across at least 5 vendors, with at least 2 paid. At least 5 compliance items covering all 4 categories, with at least 1 overdue and 1 resolved |

The drag-and-drop demo files are any files renamed to `license_renewal_okafor.pdf` (matches the rule) and `scan_0001.pdf` (no match). Any real PDF works for the preview check.

## File layout (one owner per file)

Owners are role placeholders until the team assigns names. One person can hold several roles, but each file has exactly one owner.

| File | What it does | Owner |
|---|---|---|
| `index.html` | Page shell, header, nav, search box, `<main id="view">`, CSS and `<script>` load order | Shell |
| `css/styles.css` | Font faces, tokens, the class kit, header, and `Sortable.ui` component styles | Design |
| `assets/fonts/*` | Schibsted Grotesk and JetBrains Mono `.woff2` files and their OFL license files | Design |
| `assets/logo.svg` | Sorted-bars logo | Design |
| `js/ui.js` | `Sortable.ui` shared components | Design |
| `data/mock-data.js` | `window.MOCK` seed data | Data |
| `js/store.js` | `Sortable.store` | Data |
| `js/util.js` | `Sortable.util` | Shell |
| `js/router.js` | Hash routing, params, redirects, re-render on store change, active tab, Inbox badge | Shell |
| `js/app.js` | Boot | Shell |
| `js/ai-mock.js` | `Sortable.ai` | Intake |
| `js/search.js` | `Sortable.search` | Search |
| `js/reminders.js` | `Sortable.reminders` | Deadlines |
| `js/views/dashboard.js`, `css/dashboard.css` | Today page | Today |
| `js/views/inbox.js`, `css/inbox.css` | Inbox | Intake |
| `js/views/library.js`, `css/library.css` | Files | Files |
| `js/views/search.js`, `css/search.css` | Search page | Search |
| `js/views/deadlines.js`, `css/deadlines.css` | Deadlines | Deadlines |
| `js/views/setup.js`, `css/setup.css` | Setup and "Where files live" | Intake |

Scripts load in this order:

1. `util`
2. `mock-data`
3. `store`
4. `ai-mock`
5. `search`
6. `reminders`
7. `ui`
8. the views (dashboard, inbox, library, search, deadlines, setup)
9. `router`
10. `app`

CSS loads `styles.css` first, then the six screen files in alphabetical order.

## Design tokens and class kit

These come from the notes' visual language.

**Fonts:**
- `--font-sans`: "Schibsted Grotesk" (400/500/600/700), then the system stack.
- `--font-mono`: "JetBrains Mono" (400/500), then `ui-monospace, Menlo, monospace`. Use it for file names, labels and email addresses.

**Colors:**

| Token | Value | Used for |
|---|---|---|
| `--bg` | `oklch(0.982 0.004 250)` | Page background |
| `--panel` | `oklch(0.997 0.002 250)` | Cards and panels |
| `--ink` | `oklch(0.21 0.02 255)` | Body text |
| `--muted` | `oklch(0.47 0.02 255)` | Secondary text, section labels |
| `--border` | `oklch(0.91 0.01 250)` | Card borders, lines |
| `--border-strong` | `oklch(0.88 0.012 250)` | Button and control borders |
| `--primary` / `--primary-hover` | `oklch(0.5 0.13 255)` / `oklch(0.44 0.13 255)` | Primary buttons |
| `--link` | `oklch(0.42 0.13 255)` | Links, accent text |
| `--primary-soft` | `oklch(0.94 0.035 255)` | Soft blue fill, selected rows, Best match |
| `--fill` | `oklch(0.94 0.01 250)` | Search field, segmented controls, chips |
| `--nav-active` | `oklch(0.93 0.04 255)` | Active sidebar row |
| `--track` | `oklch(0.93 0.01 250)` | Ring track |
| `--green` / `--amber` / `--orange` / `--red` | `oklch(0.6 0.14 150)` / `oklch(0.74 0.14 80)` / `oklch(0.66 0.15 52)` / `oklch(0.57 0.17 27)` | Rings, dots, big counts |
| `--green-ink` / `--amber-ink` / `--red-ink` | `oklch(0.42 0.1 150)` / `oklch(0.47 0.11 70)` / `oklch(0.48 0.15 27)` | Colored text on white |
| `--tag-current-bg` / `--tag-expiring-bg` / `--tag-expired-bg` | `oklch(0.96 0.03 150)` / `oklch(0.97 0.045 80)` / `oklch(0.96 0.03 27)` | Status tag fills |
| `--ext-pdf` / `--ext-img` / `--ext-doc` | `oklch(0.58 0.15 25)` / `oklch(0.56 0.11 160)` / `oklch(0.52 0.13 255)` | File icons |

**Shapes:**
- **Cards:** 14px radius, 1px border.
- **Pills:** buttons, chips, selects, tags and segmented toggles have a 999px radius.
- **Shadows:** none, except a soft shadow on menus, popovers, the + New button and the big search input.

**Controls:**
- **Secondary buttons:** white, 1px `--border-strong`, 13px/500, 7px 14px padding.
- **Primary buttons:** `--primary` fill, white text, 600.
- **Section labels:** 12px/600, uppercase, letter-spacing 0.05em, `--muted`.

**Date colors:**
- red (`--red-ink`) if the date is 10 days out or fewer, or past
- amber (`--amber-ink`) if 30 days or fewer
- otherwise green (`--green-ink`)

**Ring colors** (by completion %):
- 90 or more: green
- 70–89: amber
- 40–69: orange
- under 40: red

**Status tags:**

| Key | Look |
|---|---|
| `current`, `paid`, `renewed` | Current colors |
| `expiring`, `awaiting`, `unpaid` | Expiring colors |
| `expired`, `overdue` | Expired colors |
| `review`, `reading` | Soft blue |

Status tags always show their text label.

**Extra tokens:** `--radius`, `--radius-sm`, `--pill`, `--gap`, `--tap`, `--shadow-pop` and `--shadow-soft`.

**Component classes** (from `ui.js`): `.sr-only`, `.btn-icon`, `.tag`, `.tag-current`, `.tag-expiring`, `.tag-expired`, `.tag-info`, `.expiry-*`, `.file-icon`, `.cal-block`, `.ring`, `.ring-label`, `.ring-sm`, `.menu`, `.menu-item`, `.modal`, `.toast`, `.doc-mock`, `.drop-zone`, `.drop-progress`, `.details-panel`, `.timeline` and `.folder-picker`.
- The menu is positioned through a constructed stylesheet, not inline styles.
- `copyText` falls back to selecting text after 1 second if the clipboard never answers.

**Shared classes** (beyond the component styles):
- **Header:** `.app-header`, `.brand`, `.brand-logo`, `.wordmark`, `.tabs`, `.tab`, `.tab.is-active`, `.tab-badge`, `.search-box`, `.setup-link`
- **Layout:** `.page`, `.page-title`, `.section-label`, `.card`, `.card-grid`, `.muted`, `.mono`, `.empty`, `.alert-strip`
- **Controls:** `.btn`, `.btn-primary`, `.btn-link`, `.btn-danger`, `.pill-select`, `.segmented`, `.chip`, `.search-field`
- **Lists:** `.table`, `.row-actions`, `tr.is-selected`, `.bulk-bar`, `.breadcrumbs`
- **Calendar:** `.cal`, `.cal-head`, `.cal-dow`, `.cal-day`, `.cal-day.is-today`, `.cal-day.is-blank`, `.cal-item`, `.cal-item.is-overdue`, `.cal-item.is-soon`
- **Outbox:** `.outbox`, `.outbox-row`

**Checking phone width:** headless Chrome won't make a window narrower than 500px. To check a screen at phone width, load the app in a 375px-wide `<iframe>` on a test page, then compare `document.documentElement.scrollWidth` with 375.

## How we check it works

Run through this list before every demo and after any change. Open `index.html` by double-clicking it, with the devtools console open. Run the checks in order: several of them change data that later checks rely on. Call `store.settleAll()` (or wait 1.5 seconds) after each arrival.

1. Today loads with no console errors, with Wi-Fi turned off and no network requests (the fonts are local). The Inbox badge shows 3.
2. Every tab and route in the Navigation table opens at 375px and 1280px with no sideways page scroll. `#/employees/emp-07` redirects to Okafor's folder, and the Back button works.
3. The three ring percentages, legends and the "Expiring in 30 days" count match counts worked out by hand from the seed, using the `metrics()` formulas. The count is red.
4. **Send a test document** (`in-01`) shows in "Being read now", then files to `Practice documents › Invoices › Henry Schein`, with the vendor, amount and due date Nov 19, 2026 in its details panel.
5. Drop `license_renewal_okafor.pdf` on the drop zone. It files to `Employees › Providers › Okafor, Adaeze › Licenses`, expiring 730 days out. The old license shows Renewed, and its alerts are gone.
6. Simulate `in-02`, then drop `scan_0001.pdf`. Both are in the review queue and in "Needs you", not in a folder.
7. Simulate `in-03`. Click **Fix**, then **Invoices › Medline**. It files as an invoice. Simulate `in-04`. It files with no review.
8. Simulate `in-05`. The folder `Invoices › McKesson` now exists, with the invoice in it.
9. Drop any real PDF. Its preview in the review queue or details panel shows the PDF itself. A sample document's preview shows the drawn mock.
10. In Files, Employees opens grouped into the 5 departments, and **A–Z** lists all 40 people alphabetically.
11. Search "Henry Schein March". `Invoice – Henry Schein – 2026-03-12` is the first result and opens in one click. "okafor's license" puts Okafor's licenses first. "autoclave" finds the inspection document. "medline" lists the Medline folders.
12. On Okafor's license, use **Request updated version**. It shows Needs new document, appears under "Pending" on Today, and gets a weekly reminder for 2026-10-28. The seeded awaiting training shows weekly reminders sent 10-14 and 10-21.
13. In Files:
    - rename a document inline
    - star it, and it appears in Starred
    - drag it onto another folder
    - move it with the Move modal
    - delete it, restore it from Trash
    - select two documents, and the bulk bar shows "2 selected"

    The activity timeline lists each of these.
14. Confidential Medical shows the restricted banner and "Manage access".
15. In the outbox, the invoice due 2026-10-28 shows its 7-day reminder, the one due 2026-10-22 shows both, and the certification expiring 2026-12-05 shows its 60-day alert.
16. On Deadlines, **Mark as paid** on the invoice due 2026-10-28 shows Paid everywhere. Its 1-day reminder leaves "next", and its 7-day reminder stays in "sent". Grouping by Category, Vendor and Due date each work.
17. The upload box shows the forwarding address with **Copy**. On Setup, "Simulate a connection problem" shows the alert strip on Today and in Files.
18. Reload the page. Everything resets: badge 3, 5 incoming items, no dropped files.
