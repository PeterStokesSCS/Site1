# SITE1 — Full App, Front-End Icon Views & Workflow (for UX review)

**Generated:** 2026-06-07
**Purpose:** A complete, self-contained picture of what each user *sees and taps* in SITE1, and the journey through each task — written so a person or AI can give **UX feedback**: what's confusing, what steps are missing, what could be smoother from the user's point of view. No code knowledge needed.

> **Reviewer prompt suggestion:** *"This is a construction management app for a small builder. For each role, review the icon layout and the task journeys. Tell me where users would get confused, what's missing, what's too many taps, and how each process could be improved from the user's point of view."*

Icons below are the **actual** icons in the app (emoji + label + accent colour). The app is dark-themed (near-black background, orange accent). Phones show a **3-column tile grid**; Builder/Office use a desktop-style sidebar.

---

## 0. How navigation works (the spine)
- The **Project is the centre.** Most actions happen *inside a project*, via a shared **Project Dashboard** (a grid of function tiles).
- **Builder & Office** = desktop console with a left sidebar of tabs.
- **Supervisor, Worker, Subby, Client** = phone-style **tile grids**.
- Tapping a tile opens that function full-screen; a back arrow returns.
- A new **Action Queue** ("what needs doing") sits at the top of each role's home screen.

---

## 1. WORKER  📱 (simplest view — "what do I do today")

**Login → lands on:** their project home (a tile grid). Top corner shows an **on-site indicator** (green ON SITE + live timer, or red OFF SITE) that you tap to clock in/out.

**Home screen — icon grid:**

| | | |
|:--:|:--:|:--:|
| ▶ **Start Day** | ✅ **Tasks** *(red badge = count)* | 📐 **Plans** |
| 📷 **Photos** | ⚠️ **Safety** | 💬 **Chat** |

**Journeys:**
- **▶ Start Day** → big round button to **clock in / clock out**, live "time today" timer, status tiles (On Site, Time, Project, Sync). Works offline (queues, syncs later).
- **✅ Tasks** → today's tasks assigned to them; tap a task to tick it complete; progress bar at top.
- **📐 Plans** → project documents grouped by category; tap to download.
- **📷 Photos** → project photo gallery; take/add photos (auto GPS-tagged + compressed).
- **⚠️ Safety** → report a hazard: pick risk level (High/Med/Low) → category → description → submit.
- **💬 Chat** → project chat (Team/Trades/Client channels), can attach photos.

---

## 2. SUBCONTRACTOR (subby)  📱

**Login → lands on:** their project home. A banner shows their name + "Sign in before starting work." An **Action required** card appears at top when they have a PO to accept or a request outcome to view.

**Home screen — icon grid:**

| | | |
|:--:|:--:|:--:|
| ✅ **Safety Sign-In** | ± **Request Variation** | 📨 **My Requests** |
| 🧾 **My POs** | 📄 **Documents** | 📷 **Photos** |

**Journeys:**
- **✅ Safety Sign-In** → tick "I've read the SWMS" + "PPE/equipment safe" → **Sign in to site** → added to the muster.
- **± Request Variation** → submit a variation request in *any format*: write a note + attach a photo/PDF/quote → goes to the builder's review queue.
- **📨 My Requests** → track their requests: **Submitted → In Review → Approved / Rejected** (with rejection reason).
- **🧾 My POs** → purchase orders issued to them. Tap → a formatted **PO document** (company letterhead, scope, time-extension, value + GST) → **Accept / Sign**, plus a **message thread** with the builder for that PO.
- **📄 Documents** → current site documents.
- **📷 Photos** → project gallery.

> Subbies never see client pricing, margins, contract totals, or other subbies' info.

---

## 3. CLIENT (homeowner)  📱

**Login → lands on:** their build's home. Header = job number + address. A **"Requires your attention"** section sits above the progress bar (e.g. a variation to approve). Then a big **% complete** + current stage.

**Home screen — icon grid:**

| | | |
|:--:|:--:|:--:|
| 🔔 **Updates** | 📅 **Schedule** *(soon)* | ± **Variations** *(badge)* |
| 📄 **Documents** | 📷 **Photos** | 💳 **Invoices** *(soon)* |

**Journeys:**
- **🔔 Updates** → progress / milestones view.
- **± Variations** → variations sent to them. Tap one → a formatted summary (scope, cost inc GST, time impact, attachment) → **Approve with a typed signature** (two-step confirm) or **Decline with a reason**. Approved ones offer a **signed PDF download**.
- **📄 Documents** → their project documents.
- **📷 Photos** → only photos the builder marked "visible to client."
- **📅 Schedule / 💳 Invoices** → "coming soon" placeholders.

---

## 4. SUPERVISOR  📱 (runs the site)

**Login → lands on:** the **Project Dashboard** for their current site (remembers the last one). Top: project name + **ON SITE / OFF SITE** indicator (tap to clock in/out). Then a **"My actions today"** list (overdue tasks, open hazards, etc.). Then a tappable **stats strip** (On Site / Tasks Due / Issues / Hazards). Then the tile grid.

**Project Dashboard — icon grid (11 tiles, shared with Builder):**

| | | |
|:--:|:--:|:--:|
| 📊 **Overview** | 📐 **Project Docs** | ✅ **Tasks** |
| 👷 **Attendance** | 📅 **Daily Logs** | 📷 **Photos** |
| ⚠️ **Safety** | ⚡ **Issues** | ± **Variations** |
| 💰 **Commercial** | 💬 **Comms** | |

**Journeys (the ones a supervisor uses most):**
- **✅ Tasks** → 3 levels: landing (My / Project / Others) → list (grouped Overdue / Today / Upcoming) → task detail (status, reassign, comments, photos). Create task: title, assignee, priority, **due date + time, description, attachments**.
- **👷 Attendance ("On Site")** → live muster (clocked-in workers + signed-in visitors/subs). **Today / History** tabs. **+ Add** a visitor/sub (Visitor / Sub / Delivery, with SWMS + safety tick). **Sign out** a person → confirm → adjust time → total hours.
- **📅 Daily Logs** → end-of-day diary: weather, progress, deliveries, visitors, issues, auto worker-count, photos. Last 14 logs listed.
- **⚠️ Safety** → report + resolve hazards.
- **⚡ Issues** → 3-level issue tracker with comments + escalation; marking "safety related" auto-creates a linked hazard.
- **± Variations / 💰 Commercial** → see §7.
- **💬 Comms** → project chat (3 channels, inline photos).
- **📊 Overview** → project summary; **📐 Project Docs** → document register.

---

## 5. BUILDER  🖥️ (owner / director) — sidebar console

**Login → lands on:** the **Company Dashboard**. At the top: an **Action Queue** (everything needing attention across all projects). Then clickable KPI tiles, then a grid of **project health cards** (tap a card → that project's full Project Dashboard, same 11 tiles as the supervisor).

**Sidebar tabs:**

| Icon | Tab | What it does |
|:--:|---|---|
| ⊞ | **Dashboard** | Action Queue + KPIs + project health cards |
| 🏗 | **Projects** | Project list + filters; **+ New Project**; open any project's dashboard |
| 👷 | **Labour** | Timesheet approvals (Pending list, Approve / Approve All, Approved history) |
| ± | **Variations** | The variation module (also reachable in a project's Commercial) |
| ⚠️ | **Safety** | Company-level safety (placeholder) |
| 👤 | **Team** | Every user: **edit name + role**, and **assign to projects** (controls what they can see) |

**Key journeys:**
- **Create project** (🏗 Projects → + New Project): job number, address, suburb, client name/email/phone, budget → saved (address auto-located for photo GPS).
- **Open a project** → full Project Dashboard (the 11 tiles) — the builder works a project exactly like the supervisor does.
- **Approve timesheets** (👷 Labour) → one tap each or Approve All.
- **Manage team** (👤 Team) → set someone's name, role, and which projects they're on.

---

## 6. OFFICE / ADMIN  🖥️ — sidebar console

**Sidebar tabs:**

| Icon | Tab | What it does |
|:--:|---|---|
| ± | **Variations** | Approve / reject variations across all projects |
| 📋 | **Timesheets** | Approve timesheets across all projects |
| 👤 | **Clients** | Per-project client messaging |
| 📄 | **Documents** | All project documents, grouped by project |
| 📅 | **Schedule** | Placeholder |

---

## 7. THE BIG WORKFLOWS (cross-role journeys)

### 7.1 Variation lifecycle (builder ↔ client)
1. **Builder** (project → 💰 Commercial → ± Variations → **+ Raise Variation**): title, scope, reason, **cost line items** (each = cost+margin% *or* direct price; 10% GST, can exempt), optional **time-extension (EOT)**, attach evidence. A **live running contract total** updates as they price. Auto-numbered (e.g. `SCS-017-V01`). Saved as **Draft**.
2. **📄 Open document** → formatted **letterhead document** (status bar, project/client, VO number, scope, cost table, contract-sum bar, legal paragraph, signature block). **Download PDF** available.
3. **Approve for Issue** (locks it) → **Send to Client.**
4. **Client** gets a home-screen alert → reviews the document → **Approve (typed signature)** or **Decline (reason)**.
5. **Signed PDF** generated; client can download their copy; builder sees it locked + audit trail.
6. **Rejected?** → builder **revises** (original kept as "Superseded", a new Rev A/B draft created).

### 7.2 Subby request → Purchase Order
1. **Subby** submits a request (note + any-format attachment).
2. **Builder** sees it in the Variations review queue → **Convert** (AI pre-fills the fields from the attachment; builder reviews + prices) or **Reject** (reason shown to subby).
3. Converted variation runs through the normal lifecycle (7.1).
4. On client approval → builder **issues a PO** to the subby (their cost, excludes margin) → subby's request flips to **Approved**.
5. **Subby** opens **🧾 My POs** → accepts/signs the PO → messages the builder per-PO. Builder replies from **Commercial → Subbie POs**.

### 7.3 Photos (everywhere)
Take/attach a photo anywhere → it's compressed + GPS-tagged (on-site / X m / X km), categorised (Progress/Safety/Defect/QA/Delivery/General), optionally marked **visible to client**, and flows into the project gallery. Works offline (queues, uploads on reconnect).

### 7.4 Attendance & timesheets
Workers clock in/out (one tap). Subs/visitors signed onto the muster. Supervisor sees the live muster + signs people out (with total-hours calc). Timesheets → builder/office approval.

---

## 8. THE ACTION QUEUE (what needs doing — on every home screen)
A live list, per role, that auto-clears when you resolve the underlying thing:
- **Builder:** *Action Queue* — variations to price/issue, sign-offs gone quiet (3+ days), timesheets to approve, PO not accepted, high-risk hazard, receipt to confirm.
- **Supervisor:** *My actions today* — daily log not done (after 6pm), overdue task, open hazard/issue, shift left open >10h.
- **Client:** *Requires your attention* — a variation awaiting approval.
- **Subby:** *Action required* — a PO to accept, a request outcome to view.

Each item: priority badge, project, how long it's waited, and an **Open** button that jumps to the exact screen to fix it.

---

## 9. WHAT'S NOT BUILT YET (so feedback stays relevant)
- **Team module depth** — grouping Internal / Subs / Suppliers; a person detail page (licences, certs, emergency contact, history).
- **Daily Log redesign** — guided Yes/No questions, history filters + search, automatic weather.
- **On-Site polish** — company-name auto-complete, subby self-sign-out syncing to the muster, calendar date-picker in history.
- **Labour tab** as a workforce/cost view; **Supervisor personal dashboard** (their own tasks/approvals across all jobs).
- **Client Schedule + Invoices** screens (placeholders today).
- **Construction modules** — Procurement, Blockers, QA/Inspections, Defects, EOT claims (database ready, no screens).
- **Email/SMS notifications** — events fire but aren't connected to real recipients yet (deliberate).

---

## 10. Good questions for the reviewer
1. On a **phone, on-site, gloves on** — is the tile layout fast and obvious for workers/supervisors? Any tile that should be bigger / first / removed?
2. Is the **variation journey** clear from both the builder's and the client's side? Too many steps? Any confusing labels (e.g. "Approve for Issue" vs "Send")?
3. Is the **subby flow** (request → convert → PO → accept) understandable to a non-technical tradesperson?
4. Are there **missing confirmations or undo** anywhere risky (sending, signing, deleting)?
5. Does the **Action Queue** reduce hunting, or add noise? Right items? Right priorities?
6. What 3 changes would most improve the **day-to-day on-site experience**?
