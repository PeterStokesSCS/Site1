# SITE1 — Workflow & Functions Explainer
_A plain-language overview of what's been built, for review and feedback. No code knowledge needed._
_Owner: Peter Stokes · Stokes Construction Services · As of 2026-06-03_

---

## What SITE1 is
A construction operating system for residential builders. The goal: **one platform, one source of truth for every project** — replacing the scatter of texts, spreadsheets, paper dockets, photos on phones, and email chains.

It is mobile-first (works on a phone on site) but also works on desktop for office/management roles. It is a live web app — you log in at a URL; nothing to install, though it can be "added to home screen" like an app.

**Guiding principle:** the *project* is the centre of everything. Almost every record (a task, a photo, a hazard, a receipt) belongs to a project, and you reach it by opening that project's dashboard.

---

## The technology (brief, non-technical)
- **Front end:** a web app (React). Dark, industrial look. Big touch targets for gloved hands on site.
- **Back end / database:** Supabase (a hosted database + login system + file storage).
- **Login:** real accounts with email + password. Each account has a role that controls what they see.
- **AI:** Claude reads uploaded receipts/invoices and fills in the data automatically.
- **Hosting:** deployed live and auto-updates whenever changes are made.
- **Not yet connected:** n8n (an automation tool) for things like Telegram alerts, payroll export, and client emails — the app is wired for these but they're switched off until set up.

---

## The 6 user roles
Each role logs into the same app but sees a different interface suited to their job.

| Role | Who | What they do |
|---|---|---|
| **Builder / Admin** | Company owner / registered builder | Company-wide oversight: all projects, health scores, approvals, commercial, team. Desktop console. |
| **Supervisor** | Site supervisor / foreman | Runs a project day-to-day: tasks, attendance, daily logs, safety, issues, variations. Mobile. |
| **Worker** | Carpenter / apprentice / labourer | Simple daily flow: clock on, today's tasks, plans, report a hazard. Mobile. |
| **Subcontractor** | Plumber / electrician / etc. | Site sign-in (with safety acknowledgement), documents, compliance. Mobile. |
| **Client** | Homeowner | Read-only visibility: progress %, milestones, documents, variations. Mobile. |
| **Office Admin** | Office manager / contract admin | Variations, timesheets, client messaging, documents. Desktop console. |

A "dev mode" switch lets a tester preview all six roles from one login.

---

## The core idea: Project → Project Dashboard → Function
When you open a project (the Builder taps a project card; the Supervisor lands on it as their home screen), you get the **Project Dashboard** — a grid of tiles, one per function, all scoped to that project:

```
Overview      Project Docs   Tasks
Attendance    Daily Logs     Photos
Safety        Issues         Variations
Commercial    Comms
```

Tap a tile → that function opens, already filtered to this project. Back arrow returns to the grid. This is the backbone of the whole app — everything hangs off the project.

The Builder and Supervisor see the **same** dashboard (built once, shared), so there's consistency and no duplication.

---

## Each function — what it does and the workflow

### 1. Overview (project landing summary)
A read-only at-a-glance screen: current stage + % complete, health status, live counts (on site / hazards / issues), milestone tracker, the latest daily log, and a "Needs Attention" list (open high-risk hazards, pending variations, critical issues). Tapping a count jumps to that function. Answers "where is this job at right now?"

### 2. Project Docs (plans, permits, specs, engineering)
Upload project documents (PDF or photo), tag them with a category (Architectural, Engineering, Permits, Specifications, Energy Reports, Contracts, Other) and a version/revision. Documents group by category. Each is flagged **Current** or **Superseded** — when a new revision arrives you supersede the old one, so trades always open the live drawing.

### 3. Tasks (3 levels deep)
- **Landing:** three buckets — *My Tasks*, *Project Tasks*, *Team Tasks* — each with red (overdue) and orange (due today) counts.
- **List:** tasks split into Overdue / Due Today / Upcoming / Completed, with filters.
- **Detail:** open a task to change its status, reassign it, and add comments.
- Create a task with title, assignee, due date, priority (Critical/High/Medium/Low), description.
- **Workflow:** Supervisor creates and assigns → worker sees their tasks for today → taps to complete → counts update.

### 4. Attendance (site muster — "On Site")
- **Muster list:** who's currently on site — internal workers (clocked in) plus visitors/subs (signed in), with live time-on-site.
- **Sign in:** workers clock in via their own app; the supervisor can also manually add a visitor/sub/delivery (name, company, trade, phone) with SWMS + safety-rules acknowledgement.
- **Sign out:** each person has a SIGN OUT button → confirmation showing sign-in time → review/adjust the time → confirm → total hours calculated automatically.
- **Workflow:** worker clocks on → appears on supervisor's muster with a running timer → supervisor (or the worker) signs out → hours recorded → flows toward timesheets.

### 5. Daily Logs (site diary)
Submit a daily log: weather, workers on site, work completed, deliveries, site visitors, issues/delays. View previous logs. (Currently free-text; a smarter Yes/No-driven version with attendance confirmation and history filters is planned.)

### 6. Photos (site progress gallery)
Take a photo with the camera (or upload) → it lands in a project gallery, newest first. Tap any photo for a full-screen view with who took it, when, and an editable caption.

### 7. Safety (hazard register)
Report a hazard: title, risk level (High/Medium/Low), category, control measures. Hazards list with risk colour-coding. One-tap **Resolve**. High-risk items are meant to trigger an instant alert (once automation is switched on).

### 8. Issues (3 levels deep + safety link)
Same 3-bucket structure as Tasks (My / Project / Team). Priorities Critical→Low. Open an issue to resolve, **escalate** (bumps priority), or comment.
- **Safety link (key feature):** when raising an issue you're asked "Is this safety related?" If YES, it **automatically creates a linked hazard** in the Safety register, and the two stay connected — so nothing safety-related ever hides inside Issues and gets missed.

### 9. Variations & Commercial (the money)
The **Commercial** tile is a hub of financial/contractual records, each its own category:
- **Contracts, Purchase Orders, Quotes, Invoices, Receipts** — add records with reference, vendor, amount, and a status flow (Draft → Pending → Revision → Approved).
- **Variations** — raise a variation (auto-numbered, e.g. SCS-001-V01) with scope, cost, description; set Pending/Approved/Rejected.
- **Cost Tracking** — a live rollup: original budget + approved variations as the running contract value, plus totals for POs, invoices, pending variations.
- **Attachments:** any record can have a PDF/photo/receipt attached.
- **Still to come:** client *digital sign-off* on variations with a full legal audit trail.

### 10. File uploads + AI document reading (standout feature)
- Attach PDFs, receipts, or photos to commercial records and variations. On a phone the "Snap receipt" button opens the camera.
- **"Auto-fill from document":** after attaching a receipt/invoice, tap this and **Claude reads the document** and fills in vendor, amount, date, reference, and a description. You review and confirm before saving (never auto-saved — a human always checks the numbers).

### 11. Comms (project chat)
Per-project message threads in three channels: **Team**, **Trades**, **Client**. Messages persist. (Designed to later sync with Telegram and trigger branded client emails via automation.)

---

## The other role views (outside the dashboard)

### Builder console (desktop)
- **Company dashboard:** active projects, approvals pending, projects At Risk (red) / Attention (amber). Each summary tile is clickable and filters the project list. **Project Health** cards per project (job number, address, stage, budget vs spent, health colour).
- **Projects:** list + create new project; tap any to open its Project Dashboard.
- **Labour:** approve timesheets (one-tap, or approve-all).
- **Team:** list users and assign their roles.

### Office Admin console (desktop)
- **Variations:** approve/reject across projects.
- **Timesheets:** approve.
- **Clients:** per-project client message threads.
- **Documents:** all project documents grouped by project.

### Worker (mobile)
Six tiles: Start Day (clock in/out with live timer), Tasks (today's), Project Docs, Photos, Safety (report hazard), Chat.

### Subcontractor (mobile)
Safety Sign-In (acknowledge SWMS + PPE → appears on the supervisor's muster), Documents, plus placeholder tiles for tasks/compliance/photos.

### Client (mobile)
Progress % + milestone tracker, Documents, Variations. Read-only — clients never see internal discussions, labour, or financial performance.

---

## A few end-to-end workflows (to sanity-check the logic)

**Daily site attendance → payroll**
Worker clocks on (phone) → shows on supervisor's live muster with a timer → at day's end the worker or supervisor signs out → hours auto-calculated → timesheet → Builder/Office approves → (future) exports to payroll.

**Safety captured early**
Worker/Supervisor reports a hazard, or raises an Issue flagged "safety related" → a linked hazard is auto-created → high-risk ones (future) ping the supervisor instantly → resolved with the two records kept in sync.

**Capturing a cost before it's lost**
On site, snap a receipt → Claude reads it → vendor/amount/date pre-filled → supervisor confirms → it's filed under the project's Receipts with the image attached → rolls into Cost Tracking.

**Keeping the client confident**
Supervisor logs daily progress + photos → Builder/Office posts updates → client sees progress %, milestones, and documents in their own view, without any internal noise.

---

## What's built vs still to come

**Built and working (live):**
- 6 roles, real login, project-centric Project Dashboard (all 11 tiles functional)
- Tasks, Attendance (sign in/out + hours), Daily Logs, Photos, Project Docs, Safety, Issues (with safety linkage), Commercial (contracts/POs/quotes/invoices/receipts/variations/cost tracking), Comms
- File uploads + AI receipt reading
- Builder dashboard with health scores + filters; Office admin; Worker/Sub/Client views
- Offline-tolerant clock-ins/hazard reports (queue and sync)

**Partial / planned next:**
- Variations: client **digital sign-off** + legal audit trail
- Daily Log: smart Yes/No workflow, auto attendance count, history filters, edit history
- Team: rich member profiles (licences, certs, site history) + suppliers
- **Project Health Score:** currently shown manually; not yet auto-calculated from live inputs
- **Blockers dashboard** (what's stopping progress)
- **Automations (n8n):** Telegram hazard alerts, payroll export, client emails, weekly PDF reports
- Geofencing / QR attendance / push notifications (future)
- Xero/MYOB payroll integration (future)

---

## Where feedback would help most
If you're reviewing this, these are the questions worth pressure-testing:
1. **Navigation:** is "everything lives under the project" the right model, or do some things (e.g. a person's whole timesheet history, company-wide commercial) need a non-project home too?
2. **Roles:** are the six roles and their boundaries right for a residential builder? Anything a real site needs that's missing?
3. **Daily use:** what would make a busy supervisor or chippy actually use this every day instead of avoiding it?
4. **Commercial/legal:** what does a variation genuinely need to be legally defensible and to hold up if a job goes to dispute?
5. **Safety/compliance:** what's missing for real OH&S compliance (SWMS, toolbox talks, incident reporting, inductions)?
6. **The AI receipt reader:** what other documents/data entry could AI remove from people's plates?
7. **Biggest gap:** if this had to be useful on a real site next week, what's the one missing thing that would block it?
