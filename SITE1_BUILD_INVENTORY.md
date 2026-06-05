# SITE1 — Complete Build Inventory

**Generated:** 2026-06-05
**Purpose:** Full inventory of everything built in the SITE1 app, for reconciliation against the specification and hand-off to a backend developer.
**Companion:** see `SITE1_DATA_DICTIONARY.md` for the table-by-table, column-by-column data dictionary.

---

## 0. Architecture & cross-cutting facts (read first)

- **Stack:** Vite + React 19 single-page app, inline styles only (no Tailwind). Dark theme (`#0c0c0c` base, `#e07b39` orange accent), fonts Barlow Condensed / DM Sans.
- **Backend:** No custom server. The frontend talks **directly to Supabase** (PostgreSQL + Auth + Storage + Edge Functions) via `src/lib/supabase.js` using the **anon key** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- **Data layer:** `src/lib/db.js` — ~45 exported functions, thin wrappers over `supabase.from(...)`. Single source of truth for reads/writes.
- **Auth:** Supabase Auth. `App.jsx` loads the user's `profiles` row on login and routes to a role app. DB trigger `handle_new_user()` auto-creates a `profiles` row on signup.
- **Roles (6):** `builder`, `supervisor`, `worker`, `subcontractor`, `client`, `office`. Stored in `profiles.role`. Dev override via `?dev=true&role=X` (`DevSwitcher`).
- **⚠️ RLS posture (critical):** Almost every table policy is **`for all to authenticated using (true)`** — any logged-in user can read/write almost everything. Only `projects`, `tasks`, `timesheets`, `project_members` have real row scoping. **All role-based restrictions below are UI-enforced only, not enforced at the database.** Must be hardened before production.
- **Types:** IDs `uuid`, money `numeric`, timestamps `timestamptz`, dates `date`.
- **Two independent offline systems** exist (see §16).
- **Storage bucket:** `attachments` (public).
- **Deployment:** Vercel (`site1-zeta-one.vercel.app`); GitHub `PeterStokesSCS/Site1`; Supabase ref `fergdbrnwmzxyazqqkkx`.

---

## 1. Authentication, Profiles & Team/Roles

**What it does:** Users log in; role determines which app loads. Builders can reassign any user's role.

**Screens/components:** `auth/LoginScreen.jsx` (sign-in + forgot-password reset); `App.jsx` (session boot, profile fetch, role routing, "No role assigned" fallback); `builder/BuilderApp.jsx → TeamTab` (list profiles, edit role inline); `shared/DevSwitcher.jsx` (dev role switch).

**Data:** `profiles` (see dictionary). The in-app `user` object is `{ id, name, role, avatar(initials), projectId, email }`.

**Logic/rules:** Role routing switch; `updateProfile(id,{role})`; password reset via `supabase.auth.resetPasswordForEmail`.

**Incomplete:** `inviteUser()` exists in db.js but is unwired and would fail from the client (needs service-role key). User creation is currently manual in the Supabase dashboard.

**Assumptions:** Admins create auth users manually then assign roles in-app. `profiles.role` is the sole permission authority. **Bug:** `user.projectId` reads `profile.project_id`, a column that does not exist → always undefined.

---

## 2. Projects

**What it does:** The central record. Builders/office create and view projects; others scoped to assigned projects.

**Screens/components:** `BuilderApp → DashboardTab` (health cards, KPI tiles), `ProjectsTab` (create form + filter chips), `ProjectCard` (budget bar, overspend warning), `shared/ProjectHeader.jsx` (project switcher).

**Logic/rules:** RLS — builders/office see all, others see member projects. On create, address auto-geocoded (Nominatim) → writes `lat`/`lng` (best-effort). Budget bar thresholds: >90% red, >70% amber; overspend warning >90%.

**Incomplete:** No edit/delete project UI. `spent` stored but never written by any feature.

**Assumptions:** Health/phase/progress set manually. One client per project.

---

## 3. Project Dashboard (navigation hub)

**What it does:** Opening a project shows an 11-tile workspace.

**Components:** `shared/ProjectDashboard.jsx` (shared by Builder drill-in and Supervisor home). Tiles: Overview, Project Docs, Tasks, Attendance, Daily Logs, Photos, Safety, Issues, Variations, Commercial, Comms. `StatRow` shows tappable On Site / Tasks Due / Issues / Hazards counts.

**Logic:** Client-side router; optional `stats`/`badges` props.

---

## 4. Tasks

**What it does:** 3-tier task system (landing → list → detail) with comments, reassignment, due date/time, photos.

**Components:** `supervisor/TasksFeature.jsx`; `worker/WorkerApp → TasksScreen`.

**Data:** `tasks`, `task_comments` (see dictionary). Create payload: `{title, project_id, created_by, assignee_id|null, due_date|null, due_time|null, priority, description|null}`.

**Logic/rules:** Worker view = `assignee_id=me AND due_date=today AND status!=completed`. Tap toggles todo⇄completed. Priority check constraint dropped to allow `critical`. Grouped overdue/today/upcoming.

**Incomplete:** No delete. `blocked` status has no UI.

---

## 5. Attendance / Time tracking

**What it does:** Workers clock in/out; subs/visitors signed onto a muster; supervisors see today + history.

**Components:** `worker/WorkerApp → ClockScreen`; `shared/OnSiteIndicator.jsx` (+ ClockOutModal); `supervisor/OnSiteFeature.jsx` (muster, Today/History, add-visitor, sign-out); `SupervisorScreens → DailyLogScreen → AttendanceRoll`.

**Data:** `timesheets`, `site_visits` (see dictionary).

**Logic/rules:**
- "On site" = open shift (`clock_out IS NULL`), date-agnostic (avoids UTC `work_date` timezone bug).
- Clock-out finds latest open shift, `hours_worked = (out−in)/3600000` (2dp).
- `getAttendanceForDay` merges timesheets + site_visits for a local day.
- Timesheet approval by builder/office/supervisor; "Approve All" bulk action.

**Incomplete:** `rejected` timesheet status no UI. No geofence enforcement on clock-in (lat/lng/geofence_radius unused for clock). `task_description` never captured.

**Assumptions:** One open shift per worker. Hours = simple elapsed time (no breaks/overtime).

---

## 6. Daily Logs

**What it does:** Supervisor's end-of-day diary — weather, progress, deliveries, visitors, issues, worker count, photos.

**Components:** `SupervisorScreens → DailyLogScreen` (create, 14-day history, expandable attendance roll + photo attach).

**Data:** `daily_logs` (see dictionary).

**Incomplete:** No edit/delete. Weather is free text.

---

## 7. Safety / Hazards

**What it does:** Anyone reports a hazard (risk, category, description, photo); supervisors view/resolve. Issues can auto-create a linked hazard.

**Components:** `worker/WorkerApp → SafetyScreen` (report); `SupervisorScreens → SafetyScreen` (list/resolve).

**Data:** `hazards` (see dictionary). Categories from `data/mockData.js → HAZARD_CATEGORIES`.

**Logic:** `resolveHazard` sets status + `resolved_at`. Resolving a linked issue prompts to resolve its hazard.

**Assumptions:** `title` doubles as description (worker form maps description→title). `control_measures` empty from worker flow.

---

## 8. Issues / Blockers

**What it does:** 3-tier issue tracker with comments, priority escalation, optional safety→hazard linkage.

**Components:** `supervisor/IssuesFeature.jsx`.

**Data:** `issues`, `issue_comments` (see dictionary). Create form: `{title, category:"Other", priority:"medium", description, is_safety:false}`.

**Logic/rules:** `is_safety=true` → also creates a `hazards` row, links both ways. Escalate bumps priority. Fires webhook `/issues/escalate` (no-op unless configured).

**Incomplete:** No delete; limited `in_progress` UI.

---

## 9. Variations — full contract-variation workflow (Phases 1–5, unified)

The Project Dashboard **Variations** tile and **Commercial → Variations** both open the **same** module now (`shared/VariationsModule.jsx`). The old read-only dashboard screen has been removed. Uses `lib/variationCalc.js` (money maths) and `lib/variationPdf.js` (PDF).

### 9a. Builder creation form
Line items with **per-line cost mode** (margin% or direct price), **10% GST** default + per-line exempt, EOT toggle, client-instruction evidence (note + attachments), **auto-numbering** (`JOBNUMBER-V01`, set once), **auto-link** to project/client/site, **live running contract sum** (`project.budget + approved variations + this`), and internal **builder cost / margin** (builder/office only). Edit/delete while draft.

### 9b. Formatted document preview + PDF (`VariationPreview`)
**📄 Open document** renders the variation as a formatted A4 doc: Stokes **letterhead** (`src/assets/letterhead.png`), charcoal status bar + status pill, project/client/site block, VO number/title, description/reason/EOT, **cost table** (lines → subtotal → GST → total), running contract sum bar, attachments, **DBCA 1995 legal acceptance** paragraph, signature block (auto-fills client name/date once signed), ABN/VBA footer. **⬇ Download PDF** and **💾 Save signed PDF** (stores to `signed_pdf_url`) via `jsPDF`+`html2canvas` (lazy-loaded). Internal **📜 Audit history** panel (merged `audit_trail`+`revision_history` timeline + sign-off IP/device) — never on the PDF.

### 9c. Status flow + actions (builder)
`draft`/`pending` → **Edit / ✓ Approve for Issue** → `approved_for_issue` (locked) → **✍ Send to Client** → `sent` → client signs → `approved` (permanently locked) or `rejected`. Rejected → **🔔 Notify Supervisor** (manual) / **↻ Create Revision** (supersede → new `Rev A/B` draft, original preserved as `superseded`). Recall available from sent/approved_for_issue.

### 9d. Client sign-off (`client/ClientApp → VariationsScreen + SignOffModal`)
Client **dashboard alert card** when a variation is `sent`. Review formatted summary (scope/cost inc GST/EOT/attachment) + consent → type name → **Approve & Sign** (two-step) or **Decline** (+reason). Captures `client_approved`, `client_signature`, `approval_date`, **`approval_device`/`approval_ip`** (best-effort), `approval_statement_accepted`. Approved card offers **📄 Download signed PDF**. Fires `/variations/approved|rejected`.

### 9e. Subcontractor variation requests + PO loop (Phase 5)
- **Subbie submits** (`subcontractor/SubcontractorApp → RequestVariationScreen`): any-format upload + note → `subbie_requests`. Tracks outcome in **My Requests** (Submitted/In Review/Approved/Rejected + rejection reason).
- **Builder review queue** (top of VariationsModule): convert → **AI-assisted prefill** (`convert-variation` Edge Function via `lib/ai.js → convertVariation`; flags low-confidence fields; falls back to note-only if undeployed) → draft variation linked to the request; or reject with reason.
- **PO generation:** on an approved variation converted from a request, builder **🧾 Generate Subbie PO** (`purchase_orders`; PO value = builder cost excl margin; scope+EOT carried) → subbie request flips to `approved`. Fires `/po/issued`.
- **Subbie PO dashboard** (`My POs`): formatted letterhead PO document, **accept/sign**, and **per-PO messaging** (`po_messages`). Builder replies from **Commercial → Subbie POs** (`shared/PurchaseOrdersModule.jsx`).

### 9f. Office approval (`OfficeAdminApp → VariationsTab`)
Cross-project Approve/Reject on legacy `amount`. Fires `/variations/status`. (Not yet upgraded to the new module — minor.)

**Dormant pending external setup (not code gaps):** AI prefill needs `convert-variation` deployed; all notification events are no-ops until `VITE_WEBHOOK_BASE`/n8n is set. No Xero hook yet (data structure ready).

**Assumptions:** Single client signer (typed name = legal e-signature). `budget` = original contract value. Flat 10% GST. PO value defaults to internal builder cost. Financial-visibility rules enforced in UI only (see §0).

---

## 10. Commercial (contracts, POs, quotes, invoices, receipts, cost tracking)

**What it does:** Financial/contractual records per project, AI receipt reading, budget-vs-variations rollup.

**Components:** `shared/CommercialModule.jsx` — category landing, `CategoryList`, `CostTracking`.

**Data:** `commercial_items` (see dictionary).

**Logic/rules:** Receipt photos → `lib/ai.js → extractReceipt()` → Edge Function `extract-receipt` (Deno + Anthropic) → `{vendor, amount, gst, date, ref, description}` for review. Cost Tracking = `budget + approved contracts + approved variations`.

**Incomplete:** Edge function needs deployment + `ANTHROPIC_API_KEY` secret. No invoice/progress-claim generation.

---

## 11. Documents

**What it does:** Per-project document register with versioning/supersede.

**Components:** `shared/ProjectDocsScreen.jsx`, `worker → PlansScreen`, `subcontractor → DocsScreen`, `office → DocumentsTab`.

**Data:** `documents` (see dictionary).

**Logic:** Grouped by category; superseded dimmed; subs see non-superseded only.

**Incomplete:** No delete; version is free text.

---

## 12. Photos (complete subsystem)

**What it does:** Project gallery + attach-to-record, with compression, GPS verification, categories/filters, client-visibility, chat photos, offline queue, delete.

**Components:** `PhotosScreen.jsx`, `PhotoAttach.jsx`, `PhotoCaptureButton.jsx`, `CategoryBadge.jsx`, `PhotoQueueBanner.jsx`; libs `photoUtils.js`, `photoQueue.js`, `storage.js`; `client → ClientPhotosScreen`.

**Data:** `project_photos` (see dictionary). Bucket `attachments` (public).

**Logic/rules:**
- Client-side compression (canvas, ≤800KB/≤1920px), GPS capture, Haversine distance; on-site if <500m.
- Category filter tabs with counts; capture auto-tags to active filter; lightbox re-tag (builder/supervisor).
- Per-context defaults: daily log→progress+client-visible; safety issue→safety; task→progress.
- Client visibility toggle: editable by builder/supervisor, read-only status for others; client gallery = `client_visible=true`.
- Delete: builder/supervisor or owner; removes DB row + storage object.
- Offline queue (IndexedDB, auto-flush on reconnect).

**Incomplete:** No bulk ops. Chat photo deletion doesn't remove the message.

---

## 13. Messaging / Chat

**What it does:** Per-project chat, three channels (team/trades/client), inline photos.

**Components:** `SupervisorScreens → ChatScreen`; `office → ClientsTab`.

**Data:** `messages` (see dictionary).

**Logic/rules:** Photo send writes message with `image_url` + files into gallery linked to the message; client-channel photos auto `client_visible`. Fires webhook `/messages`.

**Incomplete:** No realtime (manual reload — Supabase Realtime not used anywhere). No read receipts. `content` is `not null` so image-only messages send `null` (needs attention). Note: **per-PO messaging** is built separately (`po_messages`, see §15).

---

## 14. Client portal

**What it does:** Client sees progress, schedule (soon), variations (+sign-off + signed PDF), documents, client-visible photos, invoices (soon).

**Components:** `client/ClientApp.jsx`.

**Logic:** Now shows a **dashboard alert card** for variations awaiting sign-off (§9d) and a signed-PDF download on approved ones.

**Incomplete:** Schedule + Invoices placeholders.

---

## 15. Office Admin & Subcontractor portals

- **Office (`OfficeAdminApp.jsx`):** Variations approval (cross-project), Timesheets approval, Clients messaging, Documents (all projects). Schedule placeholder.
- **Subcontractor (`SubcontractorApp.jsx`):** Now a working portal:
  - **Safety Sign-In** (SWMS + PPE → `site_visits`), **Documents** (non-superseded), **Photos** (wired).
  - **± Request Variation** → any-format upload + note → `subbie_requests` (§9e).
  - **📨 My Requests** → status tracking (Submitted/In Review/Approved/Rejected + rejection reason).
  - **🧾 My POs** → formatted letterhead PO document, **accept/sign**, **per-PO messaging** (`po_messages`) with the builder.
  - Note: still reads `user.trade` (doesn't exist on the user object → defaults empty; subbie types trade manually).

**Builder side of the PO loop:** `shared/PurchaseOrdersModule.jsx` → **Commercial → Subbie POs** inbox (PO list + two-way per-PO messaging).

---

## 16. Cross-cutting infrastructure

**Two offline systems (must reconcile):**
1. `lib/webhook.js` + `hooks/useOfflineQueue.js` + `OfflineBar.jsx` — **localStorage** queue (`bsp_offline_queue`) for **action webhooks** (clock in/out, hazards, sign-in, messages, variation/timesheet status). Posts to `VITE_WEBHOOK_BASE` (n8n). **Unset → silent no-ops.**
2. `lib/photoQueue.js` — **IndexedDB** outbox (`site1-photos`) for **photo uploads only**, auto-flush on reconnect.

**Other libs:** `geocode.js` (Nominatim, no key), `ai.js` (edge functions: `extractReceipt`, `convertVariation`), `theme.js` (colours/TILES/HEALTH), `variationCalc.js` (money maths), `variationPdf.js` (jsPDF/html2canvas, lazy-loaded).

**Edge Functions (`supabase/functions/`):** `extract-receipt` (receipt OCR), `convert-variation` (subbie request → variation fields). Both Deno + Anthropic; need deploying with `ANTHROPIC_API_KEY`.

---

## 17. Tables that EXIST in the DB but have NO UI or db.js function

Built ahead, zero frontend references:
- `blockers`, `defects`, `qa_items`, `procurement_items`, `eot_claims`, `profile_credentials` (full columns in `supabase_schema_ensure.sql`).
- `material_requests` (base schema) — no UI.
- `milestones` — `getMilestones()` read by client progress; no create/edit UI.
- `project_members` — drives RLS visibility, but **no UI assigns members** (non-builder roles currently rely on permissive `using(true)` policies).

> Now in use (no longer reserved): `subbie_requests`, `purchase_orders`, `po_messages` — see §9e/§15.

---

## 18. Partially built / incomplete (consolidated)

- Variations: two UIs not unified; no PDF, alert card, notification routing, revisions, subbie/AI/Xero.
- No project edit/delete; no task/issue/daily-log/document delete.
- `spent`, `timesheets.task_description`, `profiles.project_id` referenced but never populated.
- `inviteUser()` dead/non-functional from client.
- AI receipt + webhooks need external config (edge function deploy, secrets, `VITE_WEBHOOK_BASE`).
- No realtime anywhere.
- Subcontractor portal tiles non-functional.

---

## 19. Assumptions made (not explicitly specified)

1. Supabase is the entire backend (no separate API server).
2. Permissive RLS accepted for speed — security currently UI-enforced, not DB-enforced.
3. `projects.budget` = original contract value for running contract sum.
4. Flat 10% GST, per-line exempt; per-line margin/direct cost mode.
5. Typed full name = legally sufficient e-signature (no drawn signature yet).
6. Single client per project; one open shift per worker; hours = elapsed time.
7. Storage bucket `attachments`, public.
8. On-site radius = 500m for photo GPS; geofence not enforced on clock-in.
9. `audit_trail` / `revision_history` are app-maintained jsonb arrays, not DB-triggered.
10. Categories/enums defined in frontend code, not DB lookup tables.
