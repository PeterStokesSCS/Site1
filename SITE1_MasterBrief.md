# SCS BuildHub / SITE1 — Master Development Brief
## Single Source of Truth — All Phases
## Owner: Peter Stokes · Stokes Construction Services · Melbourne VIC
## Updated: June 2026

---

# ⚠️ RECONCILIATION — STATUS AS OF 2026-06-03 (READ FIRST)
_Much of Phase 1 here was written before recent work and is ALREADY BUILT.
Do NOT restart at "BUG 1". ✅ done · 🟡 partial · ⬜ not started._

### Phase 1.1 — Critical bugs: ALL ✅ FIXED
BUG 1 task creation ✅ · BUG 2 project switcher ✅ · BUG 3 sub sign-in persists ✅ ·
BUG 4 On Site sign-out + time calc ✅ · BUG 5 Office Admin → Supabase ✅ ·
BUG 6 Client → Supabase ✅ · BUG 7 Subcontractor → Supabase ✅

### Phase 1.2–1.8 — core architecture
- 1.2 Project Dashboard (shared Builder+Supervisor, project-scoped) ✅ — **tile set differs:**
  11 tiles built (Overview, Project Docs, Tasks, Attendance, Daily Logs, Photos, Safety,
  Issues, Variations, Commercial, Comms). **Missing from brief:** QA/Inspections, Defects,
  Procurement, Blockers ⬜ (those are Phase 2 modules below).
- 1.3 Builder stat tiles clickable + filtered ✅ (dedicated approvals view ⬜)
- 1.4 Global "+ Create Record" button ⬜
- 1.5 Photo linking to every record + client_visible 🟡 — gallery built, but table is
  `project_photos` (simpler), not yet linkable to records, no client_visible flag.
  **Schema reconcile needed** (brief wants a `photos` table).
- 1.6 Supervisor last-project persistence + live on-site indicator ✅
- 1.7 Supervisor profile button → personal dashboard ⬜
- 1.8 Delete orphaned files ✅

### Built BEYOND this brief's Phase 1
Commercial module ✅ · File uploads (Storage) ✅ · AI receipt reading (Edge Function) ✅ ·
Project Docs (current/superseded) ✅ · Overview tile ✅ · SITE1 rebrand ✅

### Phase 1.9 migrations — ✅ RUN (2026-06-03)
All tables created: blockers, defects, qa_items, procurement_items, eot_claims,
profile_credentials. Extended fields added to project_photos (category, linked_record_type,
linked_record_id, client_visible), variations (client sign-off + audit), tasks (due_time,
description, attachments), profiles (address, emergency contact). `project_photos` IS the
photos table; procurement.linked_po_id → commercial_items.
NOTE: check() constraints were omitted on the new tables (status/priority/type accept any
text); values are enforced app-side. Re-add constraints later if DB-level validation wanted.

### Genuinely remaining in Phase 1
Global Create button · Photo linking + client_visible + schema reconcile · Supervisor
personal dashboard · Team 3-section restructure · the 4 extra tiles (QA/Defects/Procurement/
Blockers) · run Phase 1.9 migrations.

### Phase 2+ — all ⬜ not started
Health Score (auto) · Blockers · Today Dashboard · QA · Defects · Procurement · SWMS ·
Commercial sign-off/audit · Team credentials · Daily Log full · EOT · Labour · Voice-to-text ·
Lessons Learned · integrations.

**Recommended start:** run Phase 1.9 migrations (after reconciling the photos table), then
pick the highest-value remaining item — Variation digital sign-off (legal) or Today Dashboard /
Blockers (daily value). Decide per session; test on iPhone each time.

---

## ORIGINAL BRIEF FOLLOWS (unchanged)
## (Note: app is now branded SITE1; SCS BuildHub = same product)

---

## CRITICAL CONTEXT — READ BEFORE ANYTHING ELSE

**What SITE1 is:**
A construction operating system for a residential builder in Melbourne's eastern suburbs. Replaces texts, spreadsheets, paper dockets, phone photos, and email chains. One platform, one source of truth for every project.

**The central design principle:**
The PROJECT is the centre of everything. Every record (task, photo, hazard, receipt, defect, inspection) belongs to a project. You reach it by opening that project's dashboard. Every module connects back to the project and links to every other module.

**The rule that governs everything:**
SITE1 should feel like a connected project control system — not a collection of separate forms. Filling in one thing should feed others automatically wherever possible.

**Live URL:** https://site1-zeta-one.vercel.app
**Stack:** Vite + React 19, inline styles only (no Tailwind), Supabase (Postgres + auth + storage), n8n webhooks (wired, not yet connected)
**Current state:** Read SCS_BuildHub_CurrentState.md for full inventory of what's built, what's partial, and what's broken.

---

## NAVIGATION MODEL (non-negotiable)

```
Builder Dashboard
      ↓
Project Card (tap to open)
      ↓
Project Dashboard (dedicated hub per project)
      ↓
Module Tile (Tasks / Safety / QA / Defects / etc.)
      ↓
List View
      ↓
Record Detail
      ↓
Attachments / Comments / Actions / History
```

Every record must have: Project link, Module link, Attachments, Comments, Action log, History trail.

---

## USER ROLES (6 — do not add more)

| Role | Interface | Primary purpose |
|---|---|---|
| Builder / Admin | Desktop console | Company-wide oversight, all projects, approvals, commercial, team |
| Supervisor | Mobile tile grid | Runs project day-to-day |
| Worker | Mobile tile grid | Clock on, tasks, plans, hazards |
| Subcontractor | Mobile tile grid | Site sign-in, SWMS, documents |
| Client | Mobile tile grid | Read-only: progress, milestones, docs, variations |
| Office Admin | Desktop console | Variations, timesheets, client comms, documents |

---

## WORK THROUGH IN THIS ORDER

**Do not skip ahead. Complete each phase before starting the next.**

---

# PHASE 1 — FIX WHAT'S BROKEN + CORE ARCHITECTURE

## Must be complete before any new modules are built.

---

## 1.1 — CRITICAL BUGS (fix first, in this order)

### BUG 1 — Task creation fails
**Location:** Supervisor → Tasks → Add Task
**Issue:** Tasks not saving to Supabase.
**Fix:** Debug task insert in db.js / TasksFeature.jsx. Check:
- Supabase insert is awaited correctly
- project_id is passed (not null)
- created_by is set to auth.uid()
- RLS policy permits insert
- Add visible error state if insert fails
**Test:** Create task, refresh, confirm it persists.

### BUG 2 — Project switcher shows mock data
**Location:** ProjectHeader.jsx
**Fix:** Replace mock project list with real getProjects() / getProjectsByUser() call. Pass real UUIDs on switch. Supervisor/Worker see only their assigned projects via project_members.

### BUG 3 — Subcontractor sign-in does not persist
**Location:** SubcontractorApp.jsx → Safety Sign-In
**Fix:** After SWMS/PPE acknowledgement, insert into site_visits table:
- project_id, visitor_name, company, trade, phone
- type: 'subcontractor', sign_in: now()
- swms_acknowledged: true, gps_lat, gps_lng
Then call webhook. Confirm sub appears on Supervisor muster.

### BUG 4 — On Site has no sign-out button
**Location:** Supervisor → On Site → each worker/visitor record
**Fix:** Add SIGN OUT button to every on-site record.
Flow: Tap SIGN OUT → confirmation dialog showing sign-in time + duration → confirm → update timesheets (workers) or site_visits (subs/visitors) with clock_out/sign_out + hours_worked calculated.

### BUG 5 — Office Admin not saving to Supabase
**Location:** OfficeAdminApp.jsx
**Fix:** Timesheet approvals and client messages currently only mutate local state. Wire to Supabase. Replace mock data reads with real db.js calls.

### BUG 6 — Client role runs on mock data
**Location:** ClientApp.jsx
**Fix:** Replace all mock data with real Supabase queries scoped to the client's assigned project(s) via project_members.

### BUG 7 — Subcontractor role runs on mock data
**Location:** SubcontractorApp.jsx
**Fix:** Replace mock data with real Supabase queries for documents, site visits.

---

## 1.2 — PROJECT DASHBOARD (critical architecture)

Create: src/components/shared/ProjectDashboard.jsx
This component is shared — Builder and Supervisor both use it.
Pass project as prop. All data scoped to that project only.

**Header:**
- Job number + address (address-first, large)
- Health pill (Green/Amber/Red) — auto-calculated (see Module 7)
- Client name + current phase
- Back arrow → returns to caller (Builder projects list or Supervisor home)

**Stats row (project-scoped only — never company-wide totals):**
- Workers on site today
- Open tasks
- Open issues
- Active hazards
- Open blockers (new)

**Module tile grid:**
| Tile | Colour | Module |
|---|---|---|
| Overview | Blue-grey | Project summary, milestones, needs attention list |
| Project Docs | Blue | Plans, permits, specs, engineering drawings |
| Tasks | Amber | Full 3-tier tasks feature |
| Attendance | Teal | On site muster, sign in/out |
| Daily Logs | Teal-dark | Site diary |
| Photos | Purple | Project gallery |
| Safety | Red | Hazard register |
| Issues | Orange | Issues register |
| QA / Inspections | Green | Hold points, checklists, stage inspections |
| Defects | Pink-red | Defect register, warranty items |
| Procurement | Steel-blue | Materials tracking, delivery management |
| Commercial | Indigo | Contracts, POs, quotes, invoices, receipts, variations, costs |
| Comms | Green-dark | Team / Trades / Client message channels |
| Blockers | Dark-red | What is stopping this project |

**Wire up:**
- Builder Projects tab: tap any project card → opens ProjectDashboard
- Supervisor home: already project-centric, confirm all data is project-scoped
- Each tile opens the relevant module, already filtered to this project

---

## 1.3 — BUILDER DASHBOARD STAT TILES (make clickable)

| Tile | On Tap |
|---|---|
| Active Projects | Filtered project list — active only |
| Items Requiring Approval | Approvals dashboard — timesheets pending, variations pending |
| At Risk | Project list filtered to health = red |
| Attention Required | Project list filtered to health = amber |

---

## 1.4 — GLOBAL CREATE RECORD BUTTON

Add a floating + button visible at all times in Supervisor, Worker, and Subcontractor views.

On tap, show record type selector:
- Photo / Video
- Task
- Issue
- Hazard
- Variation
- Delivery
- Daily Log
- Defect
- QA / Inspection
- Procurement Item

Flow:
1. Select record type
2. Select / confirm project (default: current project)
3. Simplified form for that record type
4. Add attachments
5. Save → record appears in correct module
6. Record can be linked to related records

Purpose: reduces the decision of "which module do I put this in" — user creates the record, system files it correctly.

---

## 1.5 — PHOTO / VIDEO LINKING (critical)

Photos must be attachable everywhere, not only in the Photos module.

**Attach photos/video to:** Daily Logs, Issues, Hazards, Tasks, Variations, Deliveries, Defects, QA/Inspections, Procurement Items, Commercial Records.

**Gallery behaviour:**
- Every photo appears in the project Photos module gallery
- AND under its linked record
- AND in the project timeline

**Required metadata per photo:**
```sql
ALTER TABLE photos ADD COLUMN IF NOT EXISTS project_id uuid references projects;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS uploaded_by uuid references profiles;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS linked_record_type text;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS linked_record_id uuid;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS client_visible boolean default false;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS created_at timestamptz default now();
```

**Client visible toggle:** supervisor takes a photo of a problem, marks internal, client never sees it. Only photos marked client_visible = true appear in the client portal.

**Add photo UI pattern (consistent everywhere):**
- [ 📷 Camera ] [ 📁 Upload ] buttons on every record
- Caption field after capture
- Category selector (Progress / Safety / Defect / QA / Delivery / General)
- Client visible toggle (default: off)
- Upload to Supabase storage bucket: site-photos

---

## 1.6 — SUPERVISOR PERSISTENCE

**Remember last project:**
- On project open, save project.id to localStorage key: scs_last_project_id
- On app load, if key exists, load that project automatically
- If project no longer accessible, fall back to project selector

**Current project indicator (persistent):**
Add a small persistent bar below the project header showing:

If clocked in: `17 Pilgrim Court   ON SITE  02:17:34 🟢`
If not clocked in: `17 Pilgrim Court   OFF SITE 🔴`

- Pull clock-in status from open timesheet (clock_out is null)
- Live timer ticks every second
- Purpose: prevents workers logging time to wrong project

---

## 1.7 — SUPERVISOR PROFILE BUTTON

Orange PS avatar top-right → opens personal supervisor dashboard:
- My Tasks (across all projects)
- Outstanding Actions
- Upcoming Inspections (next 7 days)
- Notifications
- My Timesheets
- Approvals Required

This is about the supervisor as an individual, not about one project.

---

## 1.8 — CLEANUP — DELETE ORPHANED FILES

Run before deploying:
```bash
rm -rf src/components/manager/
rm src/components/worker/ClockInOut.jsx
rm src/components/worker/TodaysTasks.jsx
rm src/components/worker/ReportHazard.jsx
rm src/components/worker/MyTimesheets.jsx
rm src/components/worker/RequestMaterials.jsx
rm src/hooks/useWebhook.js
rm src/hooks/useTelegram.js
rm src/lib/telegram.js
```
After deletion: npm run build — confirm no errors.

---

## 1.9 — DATABASE MIGRATIONS FOR PHASE 1

Run in Supabase SQL Editor:

```sql
-- Photos table (new)
CREATE TABLE IF NOT EXISTS photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  uploaded_by uuid references profiles,
  caption text,
  category text,
  linked_record_type text,
  linked_record_id uuid,
  client_visible boolean default false,
  file_url text not null,
  created_at timestamptz default now()
);
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos_all" ON photos FOR ALL TO authenticated USING (true);

-- Blockers table (new)
CREATE TABLE IF NOT EXISTS blockers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  source_module text,
  source_record_id uuid,
  description text,
  assigned_to uuid references profiles,
  due_date date,
  priority text check (priority in ('critical','high','medium','low')) default 'high',
  status text check (status in ('open','waiting','action_required','resolved','cancelled')) default 'open',
  action_required text,
  resolution_notes text,
  resolved_at timestamptz,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blockers_all" ON blockers FOR ALL TO authenticated USING (true);

-- Variation extended fields
ALTER TABLE variations ADD COLUMN IF NOT EXISTS photos text[];
ALTER TABLE variations ADD COLUMN IF NOT EXISTS attachments text[];
ALTER TABLE variations ADD COLUMN IF NOT EXISTS client_approved boolean default false;
ALTER TABLE variations ADD COLUMN IF NOT EXISTS client_signature text;
ALTER TABLE variations ADD COLUMN IF NOT EXISTS approval_date timestamptz;
ALTER TABLE variations ADD COLUMN IF NOT EXISTS revision_history jsonb default '[]';

-- Task extended fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time time;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments text[];

-- Profile extended fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_relationship text;

-- Credentials table
CREATE TABLE IF NOT EXISTS profile_credentials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles on delete cascade,
  type text check (type in ('licence','certificate','qualification')),
  name text not null,
  number text,
  issued_date date,
  expiry_date date,
  created_at timestamptz default now()
);
ALTER TABLE profile_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credentials_all" ON profile_credentials FOR ALL TO authenticated USING (true);

-- Defects table
CREATE TABLE IF NOT EXISTS defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  location_area text,
  description text,
  defect_type text check (defect_type in ('qa','pci','handover','warranty','damage','incomplete','rework')),
  priority text check (priority in ('critical','high','medium','low')) default 'medium',
  status text check (status in ('open','assigned','in_progress','ready_for_review','closed','rejected','warranty')) default 'open',
  assigned_to uuid references profiles,
  related_trade text,
  due_date date,
  client_visible boolean default false,
  completion_notes text,
  raised_by uuid references profiles,
  closed_by uuid references profiles,
  closed_at timestamptz,
  created_at timestamptz default now()
);
ALTER TABLE defects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defects_all" ON defects FOR ALL TO authenticated USING (true);

-- QA / Inspections table
CREATE TABLE IF NOT EXISTS qa_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  stage text,
  hold_point boolean default false,
  must_pass_before_proceeding boolean default false,
  inspection_required boolean default false,
  inspector text,
  assigned_to uuid references profiles,
  due_date date,
  status text check (status in ('not_started','in_progress','ready_for_review','approved','rejected','rework_required')) default 'not_started',
  checklist_items jsonb default '[]',
  photos_required boolean default false,
  notes text,
  rejection_reason text,
  approved_by uuid references profiles,
  approved_at timestamptz,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
ALTER TABLE qa_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_all" ON qa_items FOR ALL TO authenticated USING (true);

-- Procurement table
CREATE TABLE IF NOT EXISTS procurement_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  item_name text not null,
  category text,
  supplier text,
  required_by_date date,
  ordered_date date,
  expected_delivery_date date,
  actual_delivery_date date,
  status text check (status in ('required','selected','quoted','ordered','in_transit','delivered','installed','delayed','cancelled')) default 'required',
  linked_po_id uuid references variations,
  delivery_docket_url text,
  notes text,
  blocking_project boolean default false,
  blocker_id uuid references blockers,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "procurement_all" ON procurement_items FOR ALL TO authenticated USING (true);

-- EOT (Extension of Time) table
CREATE TABLE IF NOT EXISTS eot_claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  cause text check (cause in ('weather','client_delay','supply_chain','authority','variation','other')),
  description text,
  days_claimed int,
  date_of_delay date,
  claim_submitted_date date,
  status text check (status in ('draft','submitted','approved','rejected')) default 'draft',
  linked_daily_log_ids uuid[],
  linked_procurement_ids uuid[],
  formal_notice_url text,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
ALTER TABLE eot_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eot_all" ON eot_claims FOR ALL TO authenticated USING (true);
```

---

# PHASE 2 — NEW MODULES

## Build these after Phase 1 is complete and tested on a real iPhone.

---

## MODULE 1 — PROJECT HEALTH SCORE (auto-calculated)

**Purpose:** Make project risk visible instantly without manual input.

**Calculation (start simple, expand later):**

```
GREEN — all of the following are true:
  No critical or high open hazards
  No critical open issues
  No open blockers
  No overdue tasks (>2 days)
  No failed QA hold points
  Daily log submitted in last 2 working days

AMBER — one or more of:
  1-2 overdue tasks
  Medium open issues (>3)
  1 delayed procurement item
  1 pending variation (>7 days unapproved)
  Daily log missing >2 days
  1 unapproved variation over $5,000

RED — any one of:
  Critical open blocker
  Unresolved high-risk hazard (>48hrs)
  Failed hold point with work proceeding
  Critical issue unresolved (>24hrs)
  Major labour budget overrun (>15%)
  Unpaid invoice overdue >30 days
```

**Display:**
- Health pill on project card and project header
- Tap health pill → shows reason summary list
- Each reason is tappable → opens source record

**Implementation:**
- Calculate in db.js as getProjectHealth(projectId)
- Call on Project Dashboard load and refresh every 5 minutes
- Store result in projects.health (update automatically, not manually)

---

## MODULE 2 — BLOCKERS DASHBOARD

**Purpose:** The single screen that shows what is stopping work across all projects.

**Sources that create blockers:**
- Procurement items marked "blocking project"
- Critical issues (auto-create blocker option)
- Failed QA hold point
- Unanswered RFI / client decision pending
- Open variations blocking next stage
- Inspection not booked / failed
- High-risk safety hazard unresolved >48hrs
- EOT trigger events

**Blocker fields:**
- Project, title, source module, source record ID
- Description, assigned to, due date, priority, status
- Action required, resolution notes, date resolved

**Statuses:** Open / Waiting / Action Required / Resolved / Cancelled

**Builder Dashboard display:**
```
17 Pilgrim Court   Windows delayed      5 days   Peter   HIGH
42 Ringwood East   Frame inspection     1 day    Sam     CRITICAL
```

**Workflow:**
- Blocker created (manually or auto from procurement delay)
- Assigned to responsible person with due date
- Appears on Project Dashboard, Project Health Score, Builder Dashboard
- Resolved → source record updated, health score recalculates

---

## MODULE 3 — TODAY DASHBOARD (Supervisor home screen)

**Purpose:** Supervisors think in "today" not just "project." This becomes the supervisor's default home screen.

**Display:**
- Current assigned project (restored from last session)
- Current site status (on site / off site + timer)
- Workers on site (live count)
- Tasks due today + overdue count
- Expected deliveries today
- Inspections today and tomorrow
- Open blockers (count + highest priority)
- Daily log status (submitted / not yet)
- Open hazards count

**Quick action buttons:**
- Start Day / Finish Day
- Add Photo (opens global create → Photo)
- Daily Log
- Tasks
- Safety
- Issues
- Procurement
- QA

**Tap any item → goes directly to source module/record**

---

## MODULE 4 — QA / INSPECTIONS

**Purpose:** Compliance evidence and quality control. Separate from Safety (hazard control). QA = proof work was done correctly.

**Sections:**
- Hold Points
- Inspection Requests
- Checklists
- Photo Evidence
- Failed Items
- Completed QA Records

**Melbourne-specific hold points (pre-built templates):**
- Footing excavation
- Reinforcement / steel inspection
- Stump / post inspection
- Subfloor framing
- Wall framing
- Roof framing
- Waterproofing (photos mandatory before closing)
- Flashing
- Cladding
- Services rough-in (electrical, plumbing, HVAC)
- Insulation
- Pre-plaster inspection
- Final / handover inspection

Allow custom hold points per project.

**QA item fields:**
- Title, stage, hold point yes/no
- Must pass before proceeding yes/no (hard stop)
- Inspection required yes/no, inspector name
- Assigned to, due date
- Checklist items (each with pass/fail/na)
- Photos required yes/no (if yes, cannot submit without photos)
- Notes

**Statuses:** Not Started / In Progress / Ready for Review / Approved / Rejected / Rework Required

**Failed QA workflow:**
1. QA rejected → reason required
2. Corrective task auto-generated → assigned to responsible person
3. Rectification completed → completion photo uploaded
4. QA resubmitted → supervisor approves → closed

**Critical rule:** If hold_point = true AND must_pass_before_proceeding = true → show warning banner on project dashboard until approved. Do not silently allow work to continue.

**Victorian compliance note:** Mandatory stage inspections (frame, pre-plaster, waterproofing, final) must be by a registered building surveyor. QA record must include inspector name, registration number, certificate URL.

---

## MODULE 5 — DEFECTS

**Purpose:** Separate from Issues. Issues = problems blocking the job. Defects = workmanship, completion, and warranty items.

**Defect types:**
- QA Defect (found during construction)
- PCI Defect (Practical Completion Inspection)
- Handover Defect
- Warranty Defect (post-handover)
- Damage
- Incomplete Work
- Rework Required

**Fields:**
- Title, location/area, description
- Defect type, priority
- Assigned to (trade/worker)
- Due date, due time
- Photos (required for completion evidence)
- Related trade / subcontractor
- Client visible yes/no

**Statuses:** Open / Assigned / In Progress / Ready for Review / Closed / Rejected (reopen)

**Warranty defect workflow:**
1. Client submits via client portal (or office logs it)
2. Office/Admin classifies: Warranty / Maintenance / Damage / Out of Scope
3. If Warranty: assign to supervisor/trade
4. Rectify → upload completion photos
5. Close with notes → notify client

**Links to:** Tasks (auto-create fix task), Photos, Trade profile, Client portal

**Victorian compliance note:** Under the Domestic Building Contracts Act, defects liability period is typically 13 weeks from practical completion. All defects raised during this period must be documented and actioned. This module is your VCAT/DBDRV evidence trail.

---

## MODULE 6 — PROCUREMENT / MATERIALS TRACKING

**Purpose:** Track critical long-lead materials. Not every screw — focus on items that can stop the job if they're late.

**Item types:** Windows, Trusses, Timber, Steel, Cladding, Roofing, Plumbing fixtures, Electrical fixtures, Appliances, Joinery, Tiles, Flooring, Hardware, Hire equipment, Other.

**Statuses:** Required / Selected / Quoted / Ordered / In Transit / Delivered / Installed / Delayed / Cancelled

**Fields:**
- Item name, category, supplier
- Required by date (when job needs it)
- Ordered date, expected delivery date, actual delivery date
- Linked PO (from Commercial module)
- Delivery docket (photo upload)
- Notes, blocking project yes/no

**Delay workflow:**
1. Item marked Delayed
2. Prompt: Is this blocking the project? YES/NO
3. If YES: create Blocker record → appears on Builder Dashboard
4. Blocker assigned to relevant person (usually Pete/supervisor to chase supplier)

**Delivery workflow:**
1. Item delivered → user uploads delivery docket photo
2. Status → Delivered
3. Optional: auto-create task "Inspect delivery"

**Tab view:** Required / Ordered / In Transit / Delivered / Delayed

---

## MODULE 7 — SWMS (Safety Management)

**Victorian compliance — this is not optional.**

Current SWMS is just a tick box at sign-in. This is insufficient for WorkSafe Victoria.

**Required:**
- SWMS document uploaded per project per trade (PDF)
- Version controlled — when revised, old version superseded
- Worker/sub reads PDF in-app before acknowledging
- Acknowledgement recorded AFTER reading, not before
- If SWMS revised → all previous acknowledgements invalidated → everyone must re-acknowledge
- Record: who read which version, device, timestamp, GPS location

**Toolbox talks:**
- Brief daily/weekly safety meeting record
- Who attended (link to profiles)
- What was covered
- Supervisor signs off
- Stored per project

**Induction records:**
- Site induction completed yes/no per worker per project
- Date inducted, inducted by
- Cannot clock in to a project without completed induction record

**Credentials enforcement (critical for liability):**
- Each subcontractor profile has: licence type/number/expiry, public liability insurance expiry, WorkCover insurance expiry
- If any credential expired: hard warning on sign-in (cannot proceed until supervisor overrides with reason)
- Builder receives alert 14 days before any sub's credential expires
- Licence verification: store licence number and type for CDB, electrical, plumbing licences

---

## MODULE 8 — COMMERCIAL (full build-out)

**Rename "Variations" tab to "Commercial" across the entire app.**

**Category tiles:**

| Category | Status flow |
|---|---|
| Contracts | Draft → Executed → Expired |
| Purchase Orders | Draft → Sent → Acknowledged → Fulfilled |
| Quotes | Requested → Received → Approved → Rejected |
| Invoices | Draft → Issued → Overdue → Paid |
| Receipts | Captured → Verified → Filed |
| Variations | Pending → Approved → Rejected → Signed |
| Cost Tracking | Live rollup (no status — calculated) |

**Variation record (legally defensible — Victorian DBCA requirements):**
- Auto-number (e.g. SCS-001-V01)
- Title, scope description, cost impact
- Must be created BEFORE work starts (not after)
- Photos, PDF attachments
- Client approval: pending / approved / rejected
- Digital signature (drawn on screen)
- Approval date + timestamp
- Revision history (every change logged: who, when, what)
- Cannot mark "approved" without client signature
- If variation signed → auto-create invoice for variation amount

**AI receipt reading:**
- Snap receipt → Claude reads it → fills vendor, amount, date, reference, description
- User reviews and confirms — never auto-saves
- Matched against existing PO if possible

**Cost Tracking (live rollup):**
- Original contract value
- + Approved variations = Running contract value
- Total POs raised
- Total invoices issued
- Total receipts filed
- Pending variations (at risk)
- Budget vs actual per cost code

---

## MODULE 9 — TEAM (restructure)

**Three sections with filter:**

**Internal Staff:** Employees, Supervisors, Office Staff
**Subcontractors:** Trades, Consultants
**Suppliers:** Material Suppliers, Hire Companies

**Team member detail page:**
- Full name, role, phone, email, address, company
- Credentials: licences (type, number, expiry), certificates, qualifications
- Emergency contact (name, relationship, phone)
- Site history: projects worked on, dates, hours per project (from timesheets + site_visits)
- Credential expiry alerts: red if expired, amber if expiring within 30 days

**Supplier profiles:**
- Company name, contact, phone, email
- ABN
- Trade category
- Insurance details + expiry
- Projects engaged on
- Rating / notes

---

## MODULE 10 — DAILY LOG (full build-out)

**Weather API:**
- API: Open-Meteo (free, no key required)
- Endpoint: https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,weathercode,windspeed_10m,precipitation&timezone=auto
- Fetch on daily log open using projects.lat, projects.lng
- Display: temperature, conditions, wind speed, rainfall
- Read-only auto-fill — supervisor can add manual note

**Auto-populate worker count:**
- Pull from timesheets where clock_out is null AND work_date = today
- Pull visitor/sub count from site_visits for today
- Supervisor confirms or adjusts

**Question-based workflow:**
```
Deliveries today?          YES / NO
→ YES: "What was delivered?" text field
→ NO: auto-record "No deliveries."

Visitors on site today?    YES / NO
→ YES: show list from site_visits (auto-populated) + add manual
→ NO: auto-record "No visitors."

Issues or delays today?    YES / NO
→ YES: detail field + option to link to Issues module
→ NO: auto-record "No issues or delays."

Safety incident today?     YES / NO
→ YES: open Safety module (pre-filled project/date/reporter)
→ NO: auto-record "No safety incidents."

EOT trigger today?         YES / NO
→ YES: prompt to create EOT claim, link this daily log
→ NO: continue
```

**Attendance review before submission:**
Show confirmation screen listing all workers (from timesheets) and visitors/subs (from site_visits) for today. Supervisor confirms accuracy before submitting.

**History view:**
- Sorted newest first
- Filter: Day / Week / Month
- Search by keyword
- Each record expandable

**AI log aggregation (end of day):**
- 4:30pm trigger: AI pulls all submitted logs for this project today
- Checks against muster — identifies who hasn't submitted
- Sends prompt to missing users
- Aggregates all logs into one master daily summary
- Summary saved to project record
- Optional: emailed to Builder

---

## MODULE 11 — EOT (Extension of Time)

**Purpose:** Turn documented delays into formal claims before the contractual deadline.

**Cause types:** Weather / Client delay / Supply chain / Authority / Variation / Other

**Fields:**
- Title, cause, description
- Days claimed
- Date delay started
- Claim submitted date (must be within 10 business days of delay)
- Linked daily logs (pulls weather/delay records as evidence)
- Linked procurement items (supply chain delays)
- Formal notice (auto-generate PDF)
- Status: Draft / Submitted / Approved / Rejected

**Trigger:** Daily log "EOT trigger today? YES" auto-prompts EOT creation.

**Victorian note:** Most domestic building contracts require EOT claims within 10 business days. Missing this deadline may forfeit your entitlement.

---

## MODULE 12 — LABOUR TAB (Builder — restructure)

Rename current Labour tab. Restructure as:
- **Timesheets:** approve/reject, filter by project/worker/week
- **Attendance:** who was on site, when, how long (from timesheets + site_visits)
- **Labour Allocation:** hours per project per worker
- **Labour Budget vs Actual:** planned hours vs actual per project
- **Productivity Reporting:** placeholder (Phase 3)

---

## MODULE 13 — VOICE-TO-TEXT

Add microphone icon to all description/notes text fields across:
- Daily Log, Issue, Hazard, Task, Defect, Variation, QA Notes, Procurement Notes

Implementation: HTML Web Speech API (no third-party API needed, works on iOS Safari and Android Chrome).

```javascript
const recognition = new webkitSpeechRecognition();
recognition.continuous = false;
recognition.lang = 'en-AU'; // Australian English
recognition.onresult = (e) => setText(e.results[0][0].transcript);
```

User taps microphone → speaks → text appears in field → user edits if needed → saves.

---

## MODULE 14 — LESSONS LEARNED (data collection now, AI analysis later)

**Collect data now from:**
- Labour overruns (actual vs estimated hours per cost code)
- Defects closed (what failed, which trade, which stage)
- Variations raised (what changed and why)
- Procurement delays (what was late, which supplier)
- Failed QA items (which checklist item, which stage)
- Blockers resolved (what caused it, how long it took)

**When closing a major item, prompt:**
"Should this become a lesson learned? YES / NO"

**If YES, record:**
- Project, stage, cost code
- What happened, cause
- Time impact (days), cost impact ($)
- How to avoid next time
- Tags (e.g. "deck framing", "waterproofing", "Elite Electrical")

**Future Phase 4:** AI searches lessons during estimating for similar project elements.

---

# PHASE 3 — INTEGRATIONS

## Build after Phase 2 modules are complete.

---

## 3.1 — n8n Live Webhooks

Set VITE_WEBHOOK_BASE to live n8n URL.

All endpoints already wired in frontend. Activate and test each:

| Trigger | n8n Flow |
|---|---|
| High-risk hazard reported | Instant Telegram + email to supervisor + builder |
| Timesheet approved | Log to Google Sheets for payroll |
| Client message sent | Branded HTML email to client |
| Variation approved | Notify supervisor via Telegram |
| Daily log submitted | Summary to Builder via Telegram |
| Overdue task (1 day) | Telegram reminder to assignee |
| Critical blocker created | Telegram alert to builder |
| Procurement item delayed + blocking | Telegram alert to builder |
| Sub credential expiring (14 days) | Email alert to builder |
| QA hold point failed | Telegram alert to supervisor + builder |

---

## 3.2 — Telegram Internal Chat

- Create Telegram bot via @BotFather
- Store token in VITE_TELEGRAM_BOT_TOKEN
- Each project has a telegramChatId stored in projects table
- src/lib/telegram.js already built — activate and test
- In-app chat sends via Telegram Bot API
- Incoming messages polled every 3 seconds
- Team can reply from app OR Telegram — both sync

---

## 3.3 — Branded Client Emails

HTML email template via n8n:
- Header: SCS BuildHub logo + project address
- Body: message content
- CTA 1: Reply via email
- CTA 2: View in client portal (Vercel URL with auth token)
- Footer: optional Telegram invite + "Add to Home Screen" instructions for PWA

---

## 3.4 — Variation Digital Sign-Off (critical for Victorian compliance)

Client receives email with variation details → taps link → opens variation in client portal → reviews scope + cost → draws signature or tap-to-sign → submits → both parties receive signed PDF copy → record locked (no further edits without new revision).

This is a legal requirement under the Domestic Building Contracts Act for variations over $1,000.

---

# PHASE 4 — SCALE AND POLISH

- Standalone Client PWA (separate URL, installable)
- Push notifications (PWA service worker)
- Xero/MYOB payroll integration via n8n
- Gantt schedule view
- AI estimating feedback (from Lessons Learned data)
- Client-facing defects / warranty portal
- White-label for other builders (subdomain per company)
- Advanced reporting (labour productivity, project profitability, safety trends)

---

# DEFINITION OF DONE — PHASE 1

Phase 1 is complete when:
- [ ] All 7 critical bugs fixed and tested
- [ ] Project Dashboard exists and all 14 module tiles navigate correctly
- [ ] All data is project-scoped (no company-wide totals in project views)
- [ ] Global Create Record button works across all role views
- [ ] Photos attachable to every record type with client_visible toggle
- [ ] Supervisor last-project persistence working
- [ ] Current project on-site indicator visible and live
- [ ] Builder dashboard stat tiles all clickable with correct filtered views
- [ ] Commercial tab renamed, category tiles exist
- [ ] Team tab restructured with three sections
- [ ] Orphaned files deleted, build compiles clean with no warnings
- [ ] Everything tested on real iPhone at site1-zeta-one.vercel.app

# DEFINITION OF DONE — PHASE 2

Phase 2 is complete when:
- [ ] Project Health Score auto-calculates from live data, reasons are tappable
- [ ] Blockers Dashboard shows across all projects on Builder Dashboard
- [ ] Today Dashboard is Supervisor default home screen
- [ ] QA module with hold points, checklists, photo evidence working
- [ ] Defects module with full workflow including warranty defects
- [ ] Procurement tracking with delay → blocker auto-creation
- [ ] SWMS version control, in-app reading, re-acknowledgement workflow
- [ ] Daily log: weather API, yes/no workflow, attendance review, history, AI aggregation
- [ ] Commercial: full variation workflow with digital sign-off
- [ ] EOT module with daily log linking
- [ ] Team: credentials with expiry alerts, site history
- [ ] Voice-to-text on all description fields
- [ ] Lessons Learned data collection on record close

---

# HOW TO FEED THIS INTO CLAUDE CODE

Open terminal, navigate to project folder, run:
```bash
claude
```

Opening message:
> "Read SCS_BuildHub_CurrentState.md and SCS_BuildHub_MasterBrief.md. These are your two source documents. Work through the Master Brief in order starting with Phase 1, Section 1.1 — Critical Bugs. Fix BUG 1 first, confirm it works with a test, then move to BUG 2. Do not move to the next bug until the current one is confirmed fixed. Do not start Phase 2 modules until all of Phase 1 is complete and tested on a real iPhone."
