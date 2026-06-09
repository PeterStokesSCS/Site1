# SITE1 — Full App Recap for AI Pressure Test

**Generated:** 2026-06-09 · **Repo:** `~/Desktop/buildsafe-pro` · **Prod:** https://site1-zeta-one.vercel.app
**Purpose:** A complete, evidence-based description of the interface, every cross-role workflow, and exactly how each user's **info, uploads and downloads interact** — written so an adversarial AI reviewer can pressure-test data flow, access control, and workflow integrity.

> **Reviewer orientation.** SITE1 is a construction operating system for a small Melbourne builder (Stokes Construction Services). SPA: **Vite + React 19** (no router, no TypeScript, inline styles), **Supabase** backend (Postgres + Auth + Storage + Edge Functions), deployed on Vercel. The product spine is *the Project* — almost everything happens inside a project via a shared **Project Dashboard**. All claims below are cited to `file:line` or SQL policy. **§9 is the deliberately-honest "attack surface" section — start there if you only read one part.**

---

## 1. Roles & how an account resolves

Login = Supabase email/password. `src/lib/auth.js` loads the session + the user's `profiles.role`, which selects one of six **role apps**. A `?dev=true` switcher exists but is gated to real builder/office accounts.

| Role | Device model | App component | Posture |
|---|---|---|---|
| **Builder** (owner) | Desktop console (sidebar) / mobile bottom-nav | `builder/BuilderApp.jsx` | Full admin |
| **Supervisor** | Mobile tiles | `supervisor/SupervisorApp.jsx` | Runs a site |
| **Worker** | Mobile tiles | `worker/WorkerApp.jsx` | "What do I do today" |
| **Subcontractor** | Mobile tiles | `subcontractor/SubcontractorApp.jsx` | Sign in, request variations, accept POs |
| **Client** | Mobile tiles | `client/ClientApp.jsx` | Progress + approvals |
| **Office/Admin** | Desktop console | `office/OfficeAdminApp.jsx` | Approvals/paperwork across all projects |

Role is the **only** thing that selects the UI. Authorization for *data* is enforced (or not) by Postgres RLS — see §8.

---

## 2. Interface map — what each role sees

### Builder (`BuilderApp.jsx`)
Tabs: **Dashboard, Projects, Labour, Variations, Safety, Team.**
- **Dashboard** — company view: 4 clickable summary tiles (Active Projects, Timesheets to Approve, At Risk, Attention) + project-health grid + an **Action Queue** (`useActionItems("builder", …)`).
- **Projects** — list → click a card → full **Project Dashboard** (the shared spine; now with a project-centric header + in-context project switcher).
- **Labour** — `LabourHub.jsx`: 5 sections — Timesheets (approve), Attendance (by day), Labour Allocation (who's on which project, on-site-now dots), Hours Report (by project/worker), **Budget vs Actual** (labour budget vs hours×rate).
- **Variations / Commercial** — `VariationsModule.jsx` inside `CommercialModule.jsx`.
- **Team** — filter Internal / Subcontractors / Clients / **Suppliers** (suppliers = directory derived from `commercial_items.vendor`); tap a person → `TeamMemberDetail.jsx` (contact, credentials w/ expiry, history).

### Supervisor (`SupervisorApp.jsx`)
Lands on the **Project Dashboard** for the last-viewed project (persisted). Top bar: live **On-Site indicator** + orange avatar → **personal Supervisor Dashboard** (`SupervisorDashboard.jsx`: cross-project actions, my time, my tasks). Project-scoped metric strip (On Site / Tasks / Issues / Hazards). Tiles open shared feature screens.

### Project Dashboard (shared by builder + supervisor — `ProjectDashboard.jsx`)
Grouped tiles → each opens a feature screen via an internal `switch`:
**Site:** Tasks, Attendance, Daily Logs, Photos, Safety, Issues · **Quality & Programme:** Inspections, Defects, Timeline · **Commercial:** Commercial (contains Variations) · **Project:** Overview, Project Docs, Comms.

### Worker (`WorkerApp.jsx`)
6 tiles: **Start Day** (clock in/out), **Tasks**, **Plans & Docs**, **Photos**, **Safety** (report hazard), **Chat**. A time card shows on-site status + elapsed timer + sync state.

### Subcontractor (`SubcontractorApp.jsx`)
6 tiles: **Safety Sign-In** (and self **Sign-Out**), **Request Variation**, **My Requests**, **My POs**, **Documents**, **Photos** + an **"Action required"** card (`useActionItems("subcontractor", …)`).

### Client (`ClientApp.jsx`)
Header = progress % + phase. 6 tiles: **Updates** (milestones), Schedule (soon), **Variations** (sign-off), **Documents**, **Photos** (client-visible only), Invoices (soon) + a **"Requires your attention"** card.

### Office/Admin (`OfficeAdminApp.jsx`)
5 tabs: **Variations** (approve across all projects), **Timesheets** (approve across all projects), **Clients** (messaging), **Documents** (all projects), Schedule (soon).

---

## 3. The cross-role workflows (how info moves between users)

### A. Attendance & labour (worker + subby → supervisor → builder/office → $)
1. **Worker clocks in** → `clockIn()` inserts a `timesheets` row (`worker_id`, `project_id`, `work_date`, `clock_in`, `status:"pending"`) (`WorkerApp.jsx`, `db.js:clockIn`).
2. **Subby signs in** → direct insert into `site_visits` (`recorded_by=user.id`, `type:"subcontractor"`, SWMS/PPE flags, `sign_in`) (`SubcontractorApp.jsx`). **Subby self-signs-out** → updates own open `site_visits.sign_out`.
3. **Supervisor muster** = open `timesheets` + open `site_visits` for the project (`OnSiteFeature.jsx`); **On-Site stat** on the dashboard reflects the same. `getAttendanceForDay()` merges both for the Daily Log + history.
4. **Worker clocks out** → `clockOut()` sets `clock_out` + computes `hours_worked`.
5. **Builder/Office approve** the timesheet → `approveTimesheet()` sets `status:"approved"`, `approved_by` (`LabourHub.jsx` / `OfficeAdminApp.jsx`).
6. **Budget vs Actual** → builder enters per-worker `$/hr` (`labour_rates`, admin-only) + per-project `labour_budget`; actual cost = Σ `hours × rate` (`LabourHub.jsx BudgetView`).

### B. Tasks
Builder/Supervisor create a task (`createTask`: `assignee_id`, `due_date`, `due_time`, `priority`) → worker/assignee sees it (`getMyTasksToday`), toggles status, comments (`task_comments`), can be reassigned. Creating a task opens its detail so **photo/PDF attachments** attach immediately (`TasksFeature.jsx`).

### C. Safety (worker/supervisor) + Issues→Hazard link
Worker reports a hazard (`createHazard`: `reported_by`, `risk`, `category`, `status:"open"`) → appears in Supervisor **Safety**. Supervisor raises an **Issue**; toggling "safety related = YES" creates a **linked hazard** (`IssuesFeature.jsx`). Open high-risk hazards surface in the Action Queue.

### D. Daily Log (supervisor)
`DailyLogScreen` (`SupervisorScreens.jsx`): auto-pulls **weather** (Open-Meteo from project lat/lng, `weather.js`), auto-fills **worker count** from `getAttendanceForDay`, guided **Yes/No** questions (deliveries/visitors/issues), attendance review, then submits a `daily_logs` row. History with Day/Week/Month + search.

### E. Variation lifecycle (the legal record — multi-role)
Full engine in `VariationsModule.jsx` (+ `variationCalc.js`, `variationPdf.js`):
1. **Builder** creates a variation: line items (margin% or direct), GST, EOT, auto-ref `SCS-###-V##`, running contract sum; **internal cost/margin gated to builder/office** (client-side). Attach photos/PDFs.
2. **Approve for Issue** (locks) → **Send to Client** (`status:"sent"`, `sent_at`, webhook `/variations/issued`).
3. **Client signs** (`ClientApp.jsx SignOffModal`): typed full name **+ optional drawn-signature canvas** (`signature_image` data URL) → sets `status`, `client_approved`, `client_signature`, `approval_date`, plus **`approval_ip` (via ipify), `approval_device` (UA), `approval_statement_accepted`, `approved_version`**, appends to `revision_history`. Webhook `/variations/approved|rejected`.
4. **Signed PDF** generated (jsPDF+html2canvas), uploaded, URL saved to `signed_pdf_url`; client can download it.
5. **Rejected** → builder can **Create Revision** (Rev A/B, `supersedes_id`/`superseded_by_id`, original preserved).
6. **Office** can also approve/reject variations across all projects (`getAllVariations` → `updateVariationStatus`).
7. **Subbie path:** subby submits a **variation request** (`subbie_requests`: `submitted_by`, `trade`, `note`, `file_url`) → builder review queue → **AI convert** (`convert-variation` Edge Fn, graceful fallback) into a draft → on approval, builder issues a **Purchase Order** (`purchase_orders`, `po_value` = builder cost **excl margin**) → subby **accepts/signs** PO (`status:"accepted"`, `signature`) → per-PO messaging (`po_messages`).

### F. Quality & programme
- **Procurement** (`ProcurementModule.jsx`): order windows, lead time, mark ordered/delivered, milestone link — feeds Timeline risk rules (`MODULES.procurement=true`).
- **Inspections/QA** (`InspectionsModule.jsx`): hold points, due dates, pass/fail, photos → `inspection.due_soon` action.
- **Defects** (`DefectsModule.jsx`): snagging list, open/closed, **client-visible toggle**, photos.
- **Timeline** (`TimelineScreen`/`LookaheadScreen`): milestones with baseline `planned_date` + persisted `forecast_date`; status/variance derived; EOT "add N days" cascades + writes `forecast_changes`.

### G. Documents / plans
Builder/office upload project documents (`createDocument` → `documents.file_url`, supersede support). **All members read** them (worker/subby/client/supervisor) via `getDocuments` (filters superseded). Office sees **all** projects' docs (`getAllDocuments`).

### H. Photos (capture → client gallery)
Capture pipeline (`PhotoCaptureButton.jsx`, `photoUtils.js`): GPS (`navigator.geolocation`) + Haversine `on_site`/distance, compression (≤1920px, ~800KB JPEG), category (progress/safety/defect/qa/delivery/general), **`client_visible`** flag, **record linking** (`linked_record_type`/`linked_record_id`). Stored via `addPhoto` → `project_photos`. **Client gallery** shows only `client_visible=true` (`getClientPhotos`). Offline → IndexedDB outbox (`photoQueue.js`, DB `site1-photos`/`outbox`), auto-flush on reconnect.

### I. Messaging
- **Client channel:** office/builder ↔ client via `messages` (`channel:"client"`).
- **PO messaging:** subby ↔ builder per purchase order via `po_messages`.
- **Project chat:** `ChatScreen` (project comms), photos can flow inline → gallery.

### J. Action Queue (derived, cross-role — `actionQueue.js`)
Compute-on-read predicate registry, **never stored**, auto-resolves when source state changes; role-scoped; Melbourne-TZ. Each role gets its slice (builder company queue, supervisor "My actions today" + personal dashboard, client "requires attention", subby "action required"). Nav-intent `target:{kind,projectId,entityId}` → `KIND_TO_PROJECT_SCREEN`.

### K. Integrations (outbound)
`webhook.js` fires fire-and-forget n8n events as **CORS-simple `text/plain` POSTs** (clock in/out, site sign-in/out, variation issued/approved/rejected, PO issued, messages, hazards). `VITE_WEBHOOK_BASE` currently → a webhook.site test inbox. AI: `extract-receipt` + `convert-variation` Edge Functions (`ai.js`).

---

## 4. Uploads — where every file goes

**Single Supabase Storage bucket: `attachments`, configured PUBLIC-READ** (`supabase_migration_storage.sql:7-26`). `uploadFile()` returns a **permanent public URL** via `getPublicUrl()` (`storage.js:12`). **No signed/expiring URLs anywhere.**

| Upload | Trigger | Folder in bucket | DB column |
|---|---|---|---|
| Site/record photos | Worker/supervisor capture | `records/{project_id}/{recordType}` | `project_photos.url` (+ GPS, category, client_visible, linked_record) |
| Project gallery photos | Photos screen | `photos/{project_id}` | `project_photos.url` |
| Variation attachments | Builder, on variation | `variations/{project_id}` | `variations.attachments[]` |
| Signed variation PDF | "Save signed PDF" | `variations/{project_id}` | `variations.signed_pdf_url` |
| Commercial/receipt docs | Builder, per category | `commercial/{project_id}/{category}` | `commercial_items.file_url` |
| Project documents/plans | Builder/office | `docs/{project_id}` | `documents.file_url` |
| Subbie request file | Subby request | bucket (any-format) | `subbie_requests.file_url` |
| **Drawn signature** | Client sign-off | — (NOT a file) | `variations.signature_image` (**inline base64 data URL in DB**) |

Note: folder paths embed `{project_id}` but provide **no access control** — see §9.

## 5. Downloads / views — how files come back out

All views/downloads are **direct anchors or `<img src>` to the public URL** — no auth check at fetch time:
- Photos: `<img src={p.url}>` (`PhotoAttach.jsx:71`, `PhotosScreen.jsx:230`).
- Documents/plans: `<a href={doc.file_url} target="_blank">` (`ProjectDocsScreen.jsx:76`).
- Variation attachments + signed PDF: anchors (`VariationsModule.jsx:299`); client downloads signed PDF (`ClientApp.jsx`).
- Commercial docs: `<a href={it.file_url}>` (`CommercialModule.jsx:180`).
- AI **receipt extraction** reads an uploaded doc URL and pre-fills the commercial form (`ai.js extractReceipt`).

---

## 6. Who-writes-what / who-reads-what (data interaction matrix)

| Table | Worker | Supervisor | Subby | Client | Builder/Office |
|---|---|---|---|---|---|
| `timesheets` | **write** (clock) | read (muster) | — | — | read + **approve** |
| `site_visits` | — | read (muster) + write (visitors) | **write** (own sign in/out) | — | read |
| `tasks` (+`task_comments`) | read mine, set status | **write** | — | — | **write** |
| `hazards` | **write** (report) | read/resolve | — | — | read |
| `issues` (+`issue_comments`) | — | **write** (+ link hazard) | — | — | read |
| `daily_logs` | — | **write** | — | — | read |
| `variations` | — | read (scope/EOT notify) | request via `subbie_requests` | **write** (sign-off) | **write** (create/approve) |
| `purchase_orders` (+`po_messages`) | — | — | **read/accept own** + message | — | **write** (issue) |
| `commercial_items` | — | read | — | — | **write** |
| `documents` | read | read | read | read | **write** (+ all-projects) |
| `project_photos` | **write** | **write** + client_visible | — | **read** client_visible only | read/write |
| `milestones`/`forecast_changes` | — | read | — | **read** (progress) | **write** |
| `procurement_items`/`qa_items`/`defects` | — | read/write | — | defects: client-visible | **write** |
| `messages` (client channel) | — | — | — | read/write | **write** |
| `labour_rates` | — | — | — | — | **write (admin-only)** |
| `profiles` | read all | read all | read all | read all | **write any** (admin) |

---

## 7. End-to-end value chains (for workflow-integrity testing)

1. **Time → pay:** worker clock-in → muster → clock-out (hours) → builder/office approve → Labour Budget vs Actual (`hours × labour_rates`). *Test: can hours be edited post-approval? Who can change `hours_worked`/`status`?*
2. **Subby variation → PO → accept:** request (+file) → AI convert → priced variation → client signs → PO (cost excl margin) → subby accepts/signs → PO messages. *Test: can a subby see the builder's margin? (PO stores `po_value`=cost only — verify the margin never reaches the subby payload.)*
3. **Variation legality:** create → issue → client typed+drawn signature + IP/device/statement → signed PDF + immutable-ish `audit_trail`/`revision_history` → revisions supersede. *Test: can a variation be edited after `approved` (locked)? Can audit/revision arrays be rewritten? Atomicity of the sign-off patch?*
4. **Client visibility boundary:** client sees only `client_visible=true` photos, `sent`/decided variations, milestones, documents. *Test: can a client read non-visible photos, other projects, or builder costs/margins? (See §9.)*

---

## 8. Security model — RLS read/write boundaries (DB-enforced)

RLS was hardened in stages (`supabase_rls_stage2/4/4b.sql`). **Dominant pattern** for project tables — read **and** write:
```
project_id in (select project_id from project_members where user_id = auth.uid())
  OR exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
```
Applies to: `tasks, hazards, issues, messages, daily_logs, documents, project_photos*, timesheets, milestones, material_requests, forecast_changes, commercial_items, blockers, defects, qa_items, procurement_items, eot_claims`.

**Ownership clauses (own-row access):**
- `site_visits` — write if `recorded_by = auth.uid()` (subby self sign-in/out) or member/admin.
- `subbie_requests` — read+write if `submitted_by = auth.uid()` or member/admin.
- `purchase_orders` — read+write if `subbie_id = auth.uid()` or member/admin.
- `po_messages` / `task_comments` / `issue_comments` — **SELECT is `using(true)` (any authenticated)**; write requires own `sender_id`/`author_id` or admin.
- `profile_credentials` — read+write if `profile_id = auth.uid()` or admin.

**Confidential / special:**
- `labour_rates` — **builder/office only for BOTH read and write** (`supabase_migration_labour_rates.sql:9-11`). ✅ pay rates don't leak via the open `profiles` table.
- `profiles` — **SELECT `using(true)` (everyone authenticated reads all profiles)**; update own row, or any row if builder/office (`profiles_admin_update`).
- `projects_read_subbie` — a subby may read a project **row** only if they hold a PO or submitted a request there (label/address visibility, not membership).

---

## 9. ⚠️ Attack surface / known weaknesses (pressure-test these first)

These are **known and partly deliberate** — listed honestly so the review targets real gaps, not theatre.

1. **Public storage bucket = unauthenticated file access.** The `attachments` bucket is public-read; every photo, document, variation PDF, commercial doc and subby file is a **permanent public URL** with no expiry (`storage.js:12`, `supabase_migration_storage.sql`). DB RLS controls who can *discover* a URL (by reading the row), but **anyone with the link can fetch the file with no auth**, across any project. URLs contain `{project_id}` + `timestamp-random` (not a secret token). **Highest-impact finding.** Mitigation would be a private bucket + signed URLs.
2. **Financial columns are not column-protected.** RLS is row-level. `variations` (builder_cost, margin_amount), `purchase_orders` (po_value), `projects` (budget, labour_budget) are visible to **any project member** who can read the row. Today money/margin is hidden **client-side only** (`canSeeMargin = role in builder/office`). A member hitting the Supabase client directly can read margins. *(This is "RLS Stage 3", explicitly deferred.)*
3. **`profiles` is world-readable to any authenticated user** (`using(true)`) — names, phones, emergency contacts, addresses, company across every user, not just your project. Pay rates were deliberately kept **out** of this table for that reason (§8).
4. **`po_messages`, `task_comments`, `issue_comments` SELECT = `using(true)`** — any authenticated user can read every comment/PO message regardless of project. Writes are owner-scoped; reads are not.
5. **`notification_log` is still `for all using(true)`** (open) — the one table not covered by Stage 4b.
6. **Photo-table RLS discrepancy — VERIFY AGAINST LIVE DB.** `supabase_migration_photos.sql` created `project_photos` policies as `using(true)` (open); `supabase_rls_stage2.sql:49-53` + `stage4` **drop and recreate** them member-scoped. Whichever ran **last** wins. Confirm the live policy on `project_photos` is the member-scoped one, not the open original. *(Even if member-scoped, point 1 still exposes the files themselves.)*
7. **Webhooks send data to an external endpoint over `text/plain`.** Payloads include names, totals, client emails. Currently a test inbox; treat as a data-egress channel when a real endpoint is wired.
8. **Drawn/typed signature + approval metadata are a single `updateVariation` patch** — not a DB transaction with server-side validation. Approval IP is best-effort (ipify) and client-supplied device string. Assess non-repudiation strength for a legal record.
9. **Tester account is a builder (admin).** Playwright green only proves the admin path; non-admin RLS must be verified by logging in as a real non-admin (no `?dev`).
10. **Client-side authorization generally.** Role gating (who sees money, who sees which tiles) is React-level. The security boundary is RLS + storage policy only; enumerate everything gated *only* in the UI.

---

## 10. Deliberately deferred (don't report as bugs)

RLS Stage 3 (column/financial confidentiality via views) · private bucket + signed URLs · `MODULES.labour=false` (no scheduled-allocation roster / double-booking rule) · task↔procurement linking UI (to fully arm `material_not_on_site`) · Action Queue Phase 4 (hourly email job — needs real recipient emails) · real n8n endpoint + real client/subby emails · `$` Productivity metric + labour cost into Commercial Cost Tracking.

---

## 11. How to run / verify

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm install
npm run build          # must be clean
npm run test:unit      # vitest — 51 green (actionQueue 13 + timeline 38)
npm test               # Playwright; auth specs skip without tester creds
```
Source-of-truth schema: `supabase_schema_ensure.sql` (idempotent). Data layer: `src/lib/db.js` (every query). Companion docs: `SITE1_CURRENT_WORKFLOW.md` (behaviour), `SITE1_AI_REVIEW.md` (architecture/security brief), `SITE1_DATA_DICTIONARY.md` (tables), `SCS_BuildHub_FieldTestFeedback_Alpha01.md` (alpha backlog — 100% cleared).