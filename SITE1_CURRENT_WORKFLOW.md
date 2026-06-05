# SITE1 — Current Workflow (as built)

**Generated:** 2026-06-06
**Purpose:** A plain-English description of how the SITE1 app *actually works today*, role by role and flow by flow, suitable for review/feedback by a person or another AI. It describes real, current behaviour — including features that are stubbed or deliberately not built yet.

> If you're reviewing this for feedback: the goal is a working construction operating system for a small builder (Stokes Construction Services, Melbourne). Please flag UX gaps, missing steps, risky logic, and anything confusing — but note the "Not built yet / deliberate" section so you don't flag things we already know are pending.

---

## 1. What the app is

SITE1 is a web app (works on phone and desktop) that runs a building company's day-to-day operations. The guiding principle: **the Project is the centre of everything.** Almost every action happens inside a project, reached through a shared **Project Dashboard**.

There are **6 user roles**, each with their own tailored app:
- **Builder** (owner/director) — desktop-style console, full access.
- **Supervisor** — mobile, runs a site day-to-day.
- **Worker** — mobile, simple "what do I do today" view.
- **Subcontractor (subby)** — mobile, sign in, request variations, receive purchase orders.
- **Client** — mobile, sees their build's progress, approves variations.
- **Office/Admin** — desktop-style, approvals and paperwork across all projects.

Users log in with an email + password. Their role decides which app they see. A builder/office admin can assign people's roles and which projects they belong to.

---

## 2. Navigation model

- **Builder & Office** get a sidebar (desktop) / bottom-nav (mobile) console with tabs.
- **Supervisor, Worker, Subby, Client** get a phone-style **grid of tiles** — each tile opens a function.
- Opening a **project** (builder clicks a project card; supervisor lands on their project) shows the **Project Dashboard**: a tile grid of everything for that project — Overview, Project Docs, Tasks, Attendance, Daily Logs, Photos, Safety, Issues, Variations, Commercial, Comms.
- Builder and Supervisor share the **same** Project Dashboard screens.

---

## 3. Role-by-role walkthrough

### 3.1 Builder (the owner)
Tabs: **Dashboard, Projects, Labour, Variations, Safety, Team.**

- **Dashboard** — "Company Dashboard": four summary tiles (Active Projects, Timesheets to Approve, At Risk, Attention) that are clickable and jump to a filtered view. Below, a "Project Health" grid of cards (job number, address, client, progress bar, budget-vs-spent bar with overspend warning).
- **Projects** — list of project cards with filter chips (All / Active / Planning / At Risk / Attention). A **+ New Project** form captures job number, address, suburb, client name/email/phone, budget. On save, the address is auto-geocoded (so site photos can be GPS-verified later). **Clicking a project opens its full Project Dashboard.**
- **Labour** — timesheet approvals: a "Pending" list with per-row Approve and an "Approve All" button, plus an "Approved" history list.
- **Team** — every user with their role and **inline editing of name + role**, plus a **Projects** button to assign that person to specific projects (controls what they can see/do). Builders/office see all projects automatically.
- **Variations / Safety tabs** — currently route to the project-level modules (Variations opens the full variation module within a project context); Safety is a placeholder at the company level.

### 3.2 Supervisor (runs the site)
Lands directly on their project's **Project Dashboard** (remembers the last project). A top-corner indicator shows current project + **ON SITE** (green, live timer) or **OFF SITE** (red), and tapping it clocks in/out. A tappable stats strip shows **On Site / Tasks Due / Issues / Hazards** for the selected project.

Project Dashboard tiles the supervisor uses:
- **Tasks** — 3-tier: landing (My / Project / Others) → list (grouped overdue/today/upcoming) → detail (status, reassign, comments, photos). Create a task with title, assignee, priority, **due date + time, description, attachments**.
- **Attendance ("On Site")** — a live muster of who's on site (workers who clocked in + visitors/subs signed in). **Today** and **History** tabs. Can **add a visitor/sub** (visitor / subcontractor / delivery, with SWMS + safety acknowledgements) and **sign people out** (confirmation → adjust time → total hours calculated).
- **Daily Logs** — end-of-day site diary: weather, progress notes, deliveries, visitors, issues, auto worker-count from attendance, with photo attachments. Shows the last 14 logs.
- **Safety** — report a hazard (risk level, category, description, photo); list and resolve hazards.
- **Issues** — 3-tier issue tracker with comments and priority escalation. Marking an issue "safety related" auto-creates a linked hazard.
- **Photos** — project photo gallery (see §4.3).
- **Variations / Commercial** — see §4.1 and §4.4.
- **Comms** — project chat with 3 channels (Team / Trades / Client), supports inline photos.

### 3.3 Worker (simple daily view)
A 6-tile grid: **Start Day (clock), Tasks, Plans, Photos, Safety, Chat.**
- **Start Day** — a big round button to clock in / clock out, with a live "time today" timer and status. Works offline (queues the punch and syncs later).
- **Tasks** — "today's tasks" assigned to them; tap to mark complete; progress bar.
- **Plans** — project documents grouped by category, download links.
- **Photos** — the project gallery (can take/add photos).
- **Safety** — report a hazard.
- **Chat** — *(tile present; opens the project chat)*.

### 3.4 Subcontractor (subby)
A tile grid: **Safety Sign-In, Request Variation, My Requests, My POs, Documents, Photos.**
- **Safety Sign-In** — tick SWMS understood + PPE/equipment safe, then "Sign in to site" → adds them to the muster.
- **Request Variation** — submit a variation request in **any format**: a written note + attach a photo/PDF/quote. Goes into the builder's review queue.
- **My Requests** — track their submitted requests with status (Submitted → In Review → Approved / Rejected), and a rejection reason if declined.
- **My POs** — purchase orders the builder has issued to them: a formatted PO document (company letterhead, scope, time extension, value + GST), an **Accept/Sign** action, and a **per-PO message thread** with the builder.
- **Documents** — current (non-superseded) site documents.
- **Photos** — the project gallery.

Subbies never see client pricing, margin, contract totals, or other subbies' info.

### 3.5 Client (homeowner)
A tile grid: **Updates/Progress, Schedule, Variations, Documents, Photos, Invoices.**
- Header shows their project, a big **% complete** and current stage.
- **A prominent alert card** appears on the home screen when a variation is waiting for their approval.
- **Variations** — review variations sent to them; open a formatted summary (scope, cost incl. GST, time impact, attachment) and **approve with a typed signature** (two-step confirm) or **decline with a reason**. Approved ones offer a **signed PDF download**.
- **Documents** — their project documents.
- **Photos** — only photos the builder/supervisor marked "visible to client."
- **Schedule & Invoices** — "coming soon" placeholders.

### 3.6 Office / Admin
Tabs: **Variations, Timesheets, Clients, Documents, Schedule.**
- **Variations** — approve/reject variations across all projects.
- **Timesheets** — approve worker timesheets across all projects.
- **Clients** — per-project client messaging (the client chat channel).
- **Documents** — all project documents grouped by project.
- **Schedule** — placeholder.

---

## 4. Key end-to-end workflows

### 4.1 Variation lifecycle (the core commercial flow)
1. **Raise** — builder opens a project → Commercial → Variations → **+ Raise Variation**. Enters title, scope, reason, and **cost line items**. Each line is either "cost + margin %" or a direct price; GST is 10% by default (can be exempt per line); a time-extension (EOT) toggle adds days + reason; attach evidence/instruction. The form shows a **live running contract sum** (original contract + approved variations + this one) and, for builder/office only, the internal cost and margin. It auto-numbers (e.g. `SCS-017-V01`). Saved as a **Draft**.
2. **Preview** — **Open document** renders the variation as a formatted document on the company **letterhead**: status bar, project/client block, VO number, scope/reason/EOT, a cost table (lines → subtotal → GST → total), the running-contract-sum bar, the legal acceptance paragraph, and a signature block. There's a **Download PDF** button.
3. **Approve for Issue → Send to Client** — builder approves it (locks it from casual edits), then sends it. Status → **Awaiting Sign-off**, and the client gets a **dashboard alert**.
4. **Client signs** — client reviews the document and approves (typed signature + timestamp; device/IP recorded) or declines with a reason. Status → **Approved** (permanently locked) or **Rejected**.
5. **Signed PDF** — builder can save the **signed PDF** to the project; the client can download their copy.
6. **Revisions** — a rejected variation can be **revised**: the original is kept and marked "Superseded," and a new draft is created with the same number + a revision letter (Rev A, Rev B…).
7. **Audit trail** — every step (created, edited, approved for issue, sent, approved/rejected, superseded) is logged with who and when, viewable in the document.
8. **Office** can also approve/reject variations across projects.

### 4.2 Subby request → Purchase Order flow
1. **Subby submits** a variation request (note + any-format attachment).
2. **Builder reviews** it in the Variations queue and either **converts** it to a priced draft variation or **rejects** it with a reason (the subby sees the outcome).
   - On convert, an **AI step** reads the attachment + note and pre-fills the variation fields (title, scope, reason, cost, EOT), flagging anything it couldn't read confidently. The builder reviews and prices it.
3. The variation then goes through the normal lifecycle (§4.1).
4. When the variation is **client-approved**, the builder **issues a Purchase Order** to the subby — value = the builder's cost to the subby (excludes margin), with scope + EOT carried over. The subby's request flips to **Approved**.
5. The **subby views the PO**, accepts/signs it, and can message the builder per-PO. The builder sees those POs and messages in a **Subbie POs inbox** (Commercial → Subbie POs).

### 4.3 Photo system
- **Take or attach** photos anywhere (project gallery, or attached to a specific record like a task/issue/hazard/daily log).
- Photos are **compressed** on the device, and **GPS-tagged** with an on-site / X metres / X km status vs the project location.
- Photos have **categories** (Progress / Safety / Defect / QA / Delivery / General) with filter tabs in the gallery, and **smart defaults** by context (e.g. daily-log photos default to "Progress" and visible-to-client).
- A **"visible to client"** toggle (set by builder/supervisor) controls whether each photo shows in the client's gallery.
- Photos sent in chat also flow into the gallery.
- **Offline:** photos taken without signal are queued on the device and upload automatically when back online.
- Photos can be **deleted** by the builder/supervisor or the person who took them.

### 4.4 Commercial hub
Per project: **Contracts, Purchase Orders, Quotes, Invoices, Receipts, Variations, Subbie POs, Cost Tracking.** Each category lists items with a status. Receipts can be **AI-read** from a photo (vendor, amount, GST, date) for the builder to confirm. Cost Tracking rolls up budget + approved contracts + approved variations.

### 4.5 Attendance & timesheets
- Workers **clock in/out** (one tap; offline-safe). "On site" = an open shift (no clock-out yet).
- Visitors/subs are **signed onto the muster** by the supervisor (or sign themselves in).
- The supervisor sees a **live muster** and can **sign people out** (with time adjustment + total-hours calc).
- Timesheets flow to **builder/office for approval**.

### 4.6 Daily logs, tasks, issues, hazards, messaging
- **Daily logs** — weather, progress, deliveries, visitors, issues, auto worker-count, photos; 14-day history.
- **Tasks** — 3-tier with comments, reassignment, due date/time, attachments.
- **Issues** — 3-tier with comments, escalation, optional auto-linked safety hazard.
- **Hazards** — report (risk/category/description/photo) and resolve.
- **Messaging** — per-project chat, 3 channels (Team/Trades/Client), inline photos. *(No live/realtime updates — screens refresh on open.)*

---

## 5. Access & permissions (how data is protected)
- Each non-admin user is **assigned to specific projects** and only sees/edits data for those projects. Builders and office admins see everything.
- Subbies are an exception: they can act on their **own** requests/POs/messages and see the **name** of a project they have a PO for, but **not** that project's internal data or any financials.
- This is enforced at the database level (not just hidden in the screen).

---

## 6. What's built vs. not (so feedback is grounded)

**Fully built & working:** roles & login, project creation + dashboard navigation, tasks, attendance/timesheets, daily logs (basic), safety/hazards, issues, the full **variation lifecycle** (form → letterhead document → PDF → client sign-off → revisions → audit), the **subby request → AI convert → PO → messaging** flow, the **photo system** (categories, GPS, client-visibility, offline, delete), the **Commercial hub** + AI receipt reading, project-scoped security, and team role/project assignment.

**Partially built:** Daily Log (works, but not yet the "Yes/No question" guided flow, history filters, or auto-weather); On-Site history (Today/History tabs done, no calendar date-picker); client Schedule/Invoices and office Schedule are placeholders.

**Not built yet (deliberate / pending):**
- **Team module depth** — grouping people into Internal Staff / Subcontractors / Suppliers with filters, and a rich person-detail page (licences, certificates, emergency contact, work history). *(The database supports credentials; no screen yet.)*
- **Daily Log redesign** — guided Yes/No questions, history filters + search, automatic weather.
- **On-Site polish** — company-name auto-complete, calendar history picker, subby self-sign-out syncing to the muster.
- **Labour tab** redesigned into a workforce/cost view.
- **Supervisor personal dashboard** (their own tasks/approvals across all jobs).
- **Notifications/automation** — the app already emits events (variation issued, PO issued, etc.) but they aren't connected to email/SMS yet; this is intentionally off until real clients/subbies are onboarded.
- **Construction modules** — Procurement, Blockers, QA/Inspections, Defects, EOT claims exist in the database but have no screens yet.
- **Realtime updates** — screens refresh on open, not live.
- **Accounting integration** (e.g. Xero) — not built; data structured to support it later.

---

## 7. Things worth a reviewer's attention
- Is the **navigation** (tiles → project dashboard → function) intuitive for on-site users on a phone?
- Is the **variation flow** clear and legally sound from both the builder's and the client's side?
- Is the **subby flow** (request → convert → PO → accept) understandable to a non-technical tradesperson?
- Are there **missing steps or confirmations** in any flow (e.g. deleting, signing, sending)?
- What's the right priority order for the "not built yet" items for a small builder running real jobs?
