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

## 9. Variations ⚠️ (two parallel implementations — reconcile)

### 9a. Dashboard "Variations" tile → `SupervisorScreens.VariationsScreen` (simple, read-only)
Shows approved $ total + pending count + list using legacy fields only (`ref`, `title`, `amount`, `status`). No create/edit. **This is what the Project Dashboard Variations tile opens.**

### 9b. Commercial → Variations → `shared/VariationsModule.jsx` (Phase 1, rich — the new build)
Full builder tool: line items, GST, EOT, internal cost/margin, evidence, auto-numbering, live running contract sum, edit/delete, issue-to-client. Uses `lib/variationCalc.js`.
- **Line item (jsonb):** `{id, description, mode:"margin"|"direct", cost, margin_pct, client_amount, gst_exempt}`.
- **Auto-number** `JOBNUMBER-V01`, assigned on first save, never changes.
- **Cost modes:** margin (`client=cost×(1+margin%)`) or direct; margin=client−cost. **GST 10%** default, per-line exempt.
- **Running contract sum** = `project.budget + approved variations + this`.
- **Status flow:** draft/pending → (Send) → sent → approved/rejected; superseded. Editable only while draft/pending.
- **Audit trail** appended on created/edited/sent.
- **Role gating (UI only):** financials/margin to builder/office only; supervisor sees scope+EOT.

### 9c. Client sign-off → `client/ClientApp → VariationsScreen + SignOffModal`
Status `sent` → "Review & Sign". Modal: scope/cost(inc GST)/EOT/attachment + consent text; type full name → Approve & Sign (two-step) or Decline (+reason). Writes `client_approved`, `client_signature`, `approval_date`, `status`, appends `revision_history`. Badge counts `status='sent'`.

### 9d. Office approval → `OfficeAdminApp → VariationsTab`
Cross-project Approve/Reject (legacy `amount` only). Fires webhook `/variations/status`.

**Incomplete (vs spec):** No formatted PDF preview, no letterhead PDF generation (asset stored at `src/assets/letterhead.png`, unused), no client dashboard alert card, no IP/device capture, no notification routing, no revision (Rev A/B) UI, no subbie portal/AI conversion, no Xero. **Dashboard tile (9a) not unified with the new module (9b).**

**Assumptions:** Single client signer (typed name = legal signature). `budget` = original contract value. Flat 10% GST.

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

**Incomplete:** No realtime (manual reload — Supabase Realtime not used anywhere). No read receipts, no per-PO threads. `content` is `not null` so image-only messages send `null` (needs attention).

---

## 14. Client portal

**What it does:** Client sees progress, schedule (soon), variations (+sign-off), documents, client-visible photos, invoices (soon).

**Components:** `client/ClientApp.jsx`.

**Incomplete:** Schedule + Invoices placeholders. No dashboard alert card for new variations (badge only).

---

## 15. Office Admin & Subcontractor portals

- **Office (`OfficeAdminApp.jsx`):** Variations approval (cross-project), Timesheets approval, Clients messaging, Documents (all projects). Schedule placeholder.
- **Subcontractor (`SubcontractorApp.jsx`):** Safety Sign-In (SWMS + PPE → `site_visits`), Documents (non-superseded). **Tiles Tasks/Chat/Compliance/Photos route nowhere.** Reads `user.trade` which doesn't exist → undefined.

**Incomplete:** Spec'd subbie portal (PO view, variation upload, AI conversion, per-PO messaging) not built.

---

## 16. Cross-cutting infrastructure

**Two offline systems (must reconcile):**
1. `lib/webhook.js` + `hooks/useOfflineQueue.js` + `OfflineBar.jsx` — **localStorage** queue (`bsp_offline_queue`) for **action webhooks** (clock in/out, hazards, sign-in, messages, variation/timesheet status). Posts to `VITE_WEBHOOK_BASE` (n8n). **Unset → silent no-ops.**
2. `lib/photoQueue.js` — **IndexedDB** outbox (`site1-photos`) for **photo uploads only**, auto-flush on reconnect.

**Other libs:** `geocode.js` (Nominatim, no key), `ai.js` (edge function), `theme.js` (colours/TILES/HEALTH), `variationCalc.js` (money maths).

---

## 17. Tables that EXIST in the DB but have NO UI or db.js function

Built ahead, zero frontend references:
- `blockers`, `defects`, `qa_items`, `procurement_items`, `eot_claims`, `profile_credentials` (full columns in `supabase_schema_ensure.sql`).
- `material_requests` (base schema) — no UI.
- `milestones` — `getMilestones()` read by client progress; no create/edit UI.
- `project_members` — drives RLS visibility, but **no UI assigns members** (non-builder roles currently rely on permissive `using(true)` policies).

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
