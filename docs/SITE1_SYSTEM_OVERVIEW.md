# SITE1 — System Overview & Handoff

**Purpose of this document:** a complete, self-contained description of the SITE1 application
— product, frontend, backend, data model, workflows, security, testing, integrations, and how
to run it — written so an external developer or an AI reviewer can understand and assess the
whole system cold. Generated 2026-06-10 from the live codebase.

> Companion docs in `docs/`: `SITE1_MULTI_TENANT_DESIGN.md` (tenancy design rationale) and
> `SITE1_SANDBOX_SECURITY_REPORT.md` (security risk register + test results).

---

## 1. What it is

**SITE1** (internal/product name; repo `buildsafe-pro`) is a **construction project-management
platform** for a residential builder — Stokes Construction Services (SCS), Melbourne, VIC. It
gives every party in a build — builder/owner, office admin, site supervisor, field staff
(carpenters), subcontractors, and clients — a single role-specific app for the daily run of a
job: site attendance, tasks, safety, daily logs, photos, quality/defects, procurement,
variations (contract changes), purchase orders, and programme/timeline.

**Current maturity:** late **alpha**, field-tested on-device by the builder. One real
organisation in production. Actively being converted from a single-tenant tool into a
**commercial multi-tenant SaaS** (many builder companies, target 1,000+ users). Cross-tenant
isolation and commercial-data RBAC have been implemented and verified (see §8).

**Live URLs**
- App (prod): `https://site1-zeta-one.vercel.app`
- Source: `https://github.com/PeterStokesSCS/Site1`
- Backend: Supabase project `fergdbrnwmzxyazqqkkx` (`https://fergdbrnwmzxyazqqkkx.supabase.co`)

---

## 2. Architecture at a glance

```
┌─────────────────────────────────────────────────────────────┐
│  Browser SPA (Vite + React 19, no router, inline styles)     │
│  Role-routed: Builder / Office / Supervisor / Worker /       │
│               Subcontractor / Client apps                    │
│         │  src/lib/db.js  (≈99 functions, thin data layer)   │
└─────────┼───────────────────────────────────────────────────┘
          │  @supabase/supabase-js  (HTTPS, JWT)
┌─────────▼───────────────────────────────────────────────────┐
│  SUPABASE (the entire backend — no custom app server)        │
│  • Postgres + PostgREST (auto REST API over tables)          │
│  • Row-Level Security = THE authorization boundary           │
│  • Auth (GoTrue, email/password, JWT)                        │
│  • Storage (file/photo bucket)                               │
│  • Edge Functions (Deno): extract-receipt, convert-variation │
└──────────────────────────────────────────────────────────────┘
          │ (browser-fired, fire-and-forget)
┌─────────▼───────────────────────────────────────────────────┐
│  External (optional): n8n/webhook (VITE_WEBHOOK_BASE),       │
│  Telegram (wired, off), Anthropic API (via Edge Functions)   │
└──────────────────────────────────────────────────────────────┘
```

**The single most important architectural fact:** there is **no backend application server**.
`src/lib/db.js` is a thin client over Supabase/PostgREST. **All authorization is enforced by
Postgres Row-Level Security (RLS).** Any security reasoning must happen at the database/RLS
layer — the frontend is untrusted. Edge Functions exist only for the two AI calls (so the
Anthropic key isn't in the browser).

**Hosting/CI:** Vercel auto-deploys on push to `main` (GitHub). No container/server to operate.

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Build | Vite 8 |
| UI | React 19 (JSX, **no TypeScript**), **inline styles only** (no CSS framework) |
| Fonts/theme | Barlow Condensed (headings) / DM Sans (body); dark theme `#0c0c0c`, orange accent `#e07b39` |
| Navigation | **No router** — state-based screen switching inside each role app |
| Backend | Supabase (Postgres, PostgREST, GoTrue auth, Storage, Edge Functions/Deno) |
| Client lib | `@supabase/supabase-js` ^2.106 |
| PDF | jsPDF + html2canvas (lazy-loaded, variation documents) |
| Deploy | Vercel (prod), GitHub `main` |
| Tests | Vitest (unit), Playwright (e2e), custom sandbox security suite + k6 load |

No state-management library (React state + props + a little `localStorage`). No GraphQL. No ORM.

---

## 4. Frontend

### 4.1 Entry & role routing
`src/main.jsx` → `src/App.jsx`. `App.jsx` reads the Supabase session, loads the user's
`profiles` row, and routes to **one of six role apps** based on `profile.role`:

| Role | App component | Device target |
|---|---|---|
| `builder` (owner) | `components/builder/BuilderApp.jsx` | desktop sidebar |
| `office` (admin) | `components/office/OfficeAdminApp.jsx` | desktop sidebar |
| `supervisor` | `components/supervisor/SupervisorApp.jsx` | mobile tiles |
| `worker` (carpenter/field) | `components/worker/WorkerApp.jsx` | mobile tiles |
| `subcontractor` | `components/subcontractor/SubcontractorApp.jsx` | mobile tiles |
| `client` | `components/client/ClientApp.jsx` | mobile tiles |

`?dev=true` enables a role switcher (`DevSwitcher.jsx`) **for builder/office accounts only** —
a non-admin cannot escalate their view (`App.jsx` guards this).

### 4.2 Shared components (`components/shared/`)
Reused across role apps: `ProjectDashboard` (the in-project tile grid), `ProjectHeader`,
`BackHeader`, `ActionQueue` (the "what needs doing" feed + `useActionItems` hook),
`VariationsModule` (the flagship commercial workflow), `CommercialModule`,
`PurchaseOrdersModule`, `ProcurementModule`, `InspectionsModule`, `DefectsModule`,
`TimelineScreen` / `LookaheadScreen` (programme), `PhotosScreen` / `PhotoAttach` /
`PhotoCaptureButton` (camera + GPS + offline), `SignedMedia` (signed-URL image/link rendering),
`ProjectDocsScreen`, `OverviewScreen`, plus small UI atoms (`AppTile`, `CategoryBadge`,
`LoadingScreen`, `OfflineBar`, `OnSiteIndicator`, `useFocusRow`).

### 4.3 Library modules (`src/lib/`)
| Module | Role |
|---|---|
| `supabase.js` | Supabase client (reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) |
| `db.js` | **The data layer** — ~99 functions wrapping every table read/write (see §6) + `logAudit`/`myOrgId` |
| `auth.js` | `signOut()` (audited; all sign-out buttons route through it) |
| `actionQueue.js` | Action Queue engine — derived "what needs doing" predicates, Melbourne-TZ helpers, grouping. Pure, unit-tested |
| `timeline.js` | Timeline/forecast engine — milestone status, EOT cascade, risk rules. Pure, unit-tested |
| `variationCalc.js` / `variationPdf.js` | Variation cost maths (margins, GST, totals) + PDF rendering |
| `storage.js` | Org-scoped uploads + **signed URLs** (see §8 R2) |
| `photoQueue.js` / `photoUtils.js` | Offline photo outbox (IndexedDB) + compression/GPS |
| `weather.js` / `geocode.js` | Open-Meteo weather + Nominatim geocoding (both free, no keys) |
| `ai.js` | Calls the `extract-receipt` Edge Function |
| `webhook.js` | Fire-and-forget POST to `VITE_WEBHOOK_BASE` (n8n) as CORS-simple `text/plain` |
| `theme.js` | Tile colours/icons/labels |

~11.6k lines of app code total; largest files: `db.js` (893), `BuilderApp` (777),
`VariationsModule` (751).

### 4.4 Notable UX patterns
- **Action Queue / Attention Centre:** every role gets a computed-on-read feed of what needs
  attention (overdue tasks, pending approvals, open shifts past cutoff, EOT not applied, etc.),
  with deep-links straight to the relevant record. Never stored; auto-resolves when state
  changes. Engine in `actionQueue.js`.
- **Offline-first photos:** capture compresses + tags GPS, uploads, and if offline queues to
  IndexedDB and auto-flushes on reconnect.
- **Melbourne timezone discipline:** all "today"/day-boundary logic uses DST-aware Melbourne
  helpers (not UTC) to avoid date rollover bugs.

---

## 5. Backend (Supabase)

### 5.1 Data model — 33 tables, by domain
- **Tenancy & identity:** `organisations`, `org_members` (many-to-many: a login can belong to
  multiple orgs, with a per-org role), `profiles` (1:1 with auth user; holds `role`),
  `project_members` (who is on which project), `profile_credentials` (licences/certs, global to
  a person).
- **Projects & programme:** `projects`, `milestones` (+ `forecast_changes` audit), `tasks`
  (+ `task_comments`).
- **Site operations:** `daily_logs`, `timesheets` (clock in/out), `hazards`, `issues`
  (+ `issue_comments`), `blockers`, `site_visits` (visitor/sub sign-in), `project_photos`.
- **Quality:** `qa_items` (inspections/hold points), `defects` (snagging/punch list).
- **Procurement & materials:** `procurement_items`, `material_requests`.
- **Commercial & contract:** `variations` (+ `variation_labour`), `commercial_items` (cost
  line items), `eot_claims` (extension-of-time), `subbie_requests` (subcontractor change
  requests), `purchase_orders` (+ `po_messages`), `documents`.
- **Confidential:** `labour_rates` (pay rates — isolated, builder/office only).
- **System:** `notification_log` (idempotency for the deferred email job), `audit_log`
  (security/event log).

Relationships are conventional Postgres FKs; most operational tables hang off `projects`
(`project_id`) and reference `profiles` for who-did-what. **Several tables have 2+ FKs to
`profiles`** (e.g. `tasks.assignee_id` + `created_by`; `purchase_orders.subbie_id` +
`created_by`) — PostgREST embeds on these MUST be disambiguated with the explicit FK name
(e.g. `assignee:profiles!tasks_assignee_id_fkey(...)`), or the query errors and returns empty.
This caused a real "records disappear" bug; all embeds are now disambiguated.

### 5.2 Multi-tenancy
Shared-schema model: every operational table has an `org_id` column. Two helper functions
(`auth_org_ids()`, `is_org_admin(org_id)`, both `SECURITY DEFINER` to avoid RLS recursion)
resolve the caller's orgs/role. `org_id` is auto-filled on insert by `BEFORE INSERT` triggers
(`set_org_from_project` / `set_org_from_user` / parent-derived variants), so the app rarely
sets it explicitly. See `docs/SITE1_MULTI_TENANT_DESIGN.md`.

### 5.3 RLS (the security boundary) — layered
1. **Restrictive tenant gate** (`tenant_isolation`, Phase 3): one `RESTRICTIVE` policy per
   `org_id` table requiring `org_id IN (select auth_org_ids())`. Restrictive policies AND with
   everything, so this isolates tenants without rewriting existing logic.
2. **Permissive role/membership policies** (per table): grant access by project membership
   and/or role. Commercial tables (`purchase_orders`, `variations`, `commercial_items`,
   `eot_claims`, `procurement_items`) are gated to builder/office + the project's supervisor
   (+ the issued subcontractor for POs; + the client for variation approval) — field staff and
   clients excluded (RLS Stage 3a/3b).
3. **Confidential columns:** `labour_rates` is builder/office-only.

### 5.4 Auth
Supabase GoTrue, email/password, JWT. `profiles.role` drives the UI; `org_members.role` drives
tenancy. Login/logout/failed-login are written to `audit_log` (see §8 R3).

### 5.5 Storage
Single bucket `attachments`. Files are written under `<org_id>/<folder>/<file>` and served via
**short-lived signed URLs** (`storage.js` + `SignedMedia` components). Legacy rows that stored a
public URL still render (pass-through) until the bucket is flipped fully private — see §8 R2.

### 5.6 Edge Functions (Deno) — `supabase/functions/`
- `extract-receipt` — receipt OCR (image → structured fields) via Anthropic API.
- `convert-variation` — turns a free-form subcontractor request into structured variation
  fields via Anthropic API, with graceful fallback.
Both share an `ANTHROPIC_API_KEY` secret. Deploy:
`supabase functions deploy <name> --project-ref fergdbrnwmzxyazqqkkx`.

---

## 6. The data layer API (`src/lib/db.js`)

~99 exported async functions — the complete surface the frontend uses. Grouped:
- **Projects:** getProjects, getProjectsByUser, createProject, updateProject
- **Tasks:** getTasksByProject, getMyTasks(Today), updateTaskStatus, createTask
- **Attendance/labour:** clockIn, clockOut, getTodayClockIn, getAllTimesheets,
  approveTimesheet, getAttendanceForDay, getMyTimesheets, getWorkerApprovedHours,
  approveProjectDayLabour, amendTimesheet, getLabourRates, upsertLabourRate
- **Safety/site:** getHazardsByProject, createHazard, resolveHazard, getDailyLogs,
  createDailyLog, getIssues, createIssue
- **Variations & commercial:** getVariations, createVariation, updateVariation(Status),
  deleteVariation, getAllVariations, getCommercialItems, createCommercialItem,
  updateCommercialStatus, createVariationLabour / getVariationLabour /
  getUnlinkedVariationLabour / linkVariationLabour, eot/procurement CRUD
- **Subbie & POs:** createSubbieRequest, getMySubbieRequests, getSubbieRequests,
  updateSubbieRequest, createPurchaseOrder, getPurchaseOrders, getMyPurchaseOrders,
  updatePurchaseOrder, getPoMessages, sendPoMessage
- **Photos:** addPhoto, getPhotos, getPhotosForRecord, getClientPhotos, deletePhoto,
  caption/category updates, setPhotoClientVisible, request/approve/rejectClientVisibility,
  getPendingVisibilityRequests
- **Quality/programme:** defects CRUD, qaItems CRUD, milestones CRUD + seedProjectMilestones,
  recordForecastChange, getDailyRecord (composite)
- **Team/admin:** getProfiles, updateProfile, project members add/remove, profile credentials,
  inviteUser
- **Cross-cutting:** `myOrgId()` (cached org resolution), `logAudit()` (fire-and-forget audit)

---

## 7. Roles & core workflows

### 7.1 Roles and what they can do
- **Builder / Owner** — full access within their org: all projects, commercial, variations,
  POs, labour, team, timeline.
- **Office / Admin** — commercial + admin within the org.
- **Supervisor** — assigned projects: site records, tasks, photos, QA, hazards, defects,
  variations; reviews daily labour; requests client visibility.
- **Worker / Field staff** — assigned tasks, clock in/out, submit photos/daily logs/QA/hazards.
  **No commercial access.**
- **Client** — only approved client-visible progress (photos, milestones), variations sent to
  them (review/approve with signature), their signed documents.
- **Subcontractor** — their own assigned work, POs issued to them (accept/sign), variation
  requests they submit, per-PO messaging.

### 7.2 Flagship workflow — Variations (contract changes)
The most complex flow, end-to-end:
1. **Origination:** supervisor raises, or a **subcontractor submits a request** (any-format
   upload) → builder review queue → **AI `convert-variation`** drafts structured fields (or
   reject).
2. **Builder draft:** line-item form with per-line margin %/direct cost, 10% GST, EOT days,
   auto-numbering (e.g. `SCS-017-V01`), live running contract sum. Internal cost/margin is
   gated to builder/office.
3. **Finalise → Send:** locks the document; client gets a dashboard alert.
4. **Client sign-off:** typed + drawn signature, device/IP captured → signed **PDF** generated
   (jsPDF/html2canvas) and stored.
5. **Revision control:** Rev A/B supersede; full audit trail.
6. **Subbie PO path:** approved request → **purchase order** generated (value = builder cost
   excl. margin) → subcontractor accepts/signs in their portal → per-PO messaging.

### 7.3 Other workflows
- **Attendance:** worker clock in/out (GPS) → muster list (On-Site) → supervisor end-of-day
  labour review (per-worker hours, open shifts, amend with audit) → timesheet approval.
- **Daily log:** guided Yes/No flow (deliveries/visitors/issues), auto weather from site
  lat/lng, attendance review, optional variation-labour capture.
- **Safety:** hazards + issues; a safety-related issue can spawn a linked hazard.
- **Photos:** capture (GPS + compression + offline queue), categorise, link to records, and a
  **client-visibility approval** flow (supervisor/worker request → builder approves → client
  sees only approved).
- **Quality:** QA inspections/hold points (pass/fail) and defects/snagging (open/close,
  client-visible toggle).
- **Procurement/timeline:** materials with lead-time/order-by; milestone forecast engine with
  EOT cascade; Supervisor "Lookahead" and Client "Progress" views.
- **Action Queue:** every role's prioritised, deep-linked "what needs doing" feed.

---

## 8. Security posture (current)

Tracked in detail in `docs/SITE1_SANDBOX_SECURITY_REPORT.md`. Headline status:

| Risk | State |
|---|---|
| **R1 — cross-org data leakage** | ✅ **Closed & verified.** Phase 3 restrictive RLS on all 29 org_id tables; 23 isolation tests pass as real seeded users. |
| **R3 — no audit log** | ✅ **Active & verified.** `audit_log` + `record_audit()` RPC; `logAudit` wired for login/logout/failed-login, create/delete, visibility-approved, variation sent/signed, po-issued, role/assignment changes. Admin-only read, no cross-org. |
| **R6 — commercial RBAC** | ✅ POs, variations, and the 3 financial tables gated to builder/office + supervisor (+ subbie/client where appropriate); field staff/clients excluded. Verified. |
| **R2 — public file bucket** | 🟠 App-side done (org-scoped paths + signed URLs). **Final step pending:** migrate existing objects under an org prefix, then flip the bucket private (`supabase_migration_storage_private.sql`). |
| **R6b — residual `using(true)` policies** | 🟠 33 dev-era "allow all" policies existed; commercial ones removed. **Open:** ops tables (defects, qa, messages, etc.) still allow blanket within-org access (mostly intended for the site team) — **review client/subbie exposure to `subbie_requests` + `po_messages`**. |
| **R5 — client-visibility server enforcement** | 🟠 Now partly covered by RLS; confirm no UI-only gates remain. |

**Important caveat for any reviewer:** the production tester account is a **builder (admin)**.
Green Playwright/e2e runs only prove the admin path. Real authorization confidence comes from
the **sandbox security suite** (below), which logs in as non-admin users across multiple orgs.

---

## 9. Testing

| Suite | Command | What it covers |
|---|---|---|
| **Unit** (Vitest) | `npm run test:unit` | Pure logic: Action Queue + Timeline engines (67 tests) |
| **E2E** (Playwright) | `npm test` | Browser flows as the builder/admin account |
| **Sandbox security** (Vitest, live DB) | `npm run sandbox:reseed && npm run sandbox:test` | **Multi-tenant isolation + role-based access + audit**, run as real seeded users (anon key ⇒ RLS enforced). Currently **39/39 green**. |
| **Load** (k6) | `npm run load:smoke\|100\|250\|500\|1000` | Concurrent VUs against Supabase REST/Auth; p95, error rate, bottlenecks. Smoke verified (0% fail, p95 ~336ms). |

The sandbox harness (`tests/sandbox/`) seeds 5 orgs × 20 users × all roles × projects +
entities (synthetic), runs the matrix, and tears down (`reset.mjs`). It auto-skips without
credentials so `test:unit` stays green in CI. Secrets live in **`tests/.env.test`
(git-ignored)** — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 10. Integrations
- **Webhook / n8n** (`VITE_WEBHOOK_BASE`): events (variation issued/approved, messages, etc.)
  fire from the **browser** as CORS-simple `text/plain` POSTs (no preflight). Currently points
  at a test inbox; real n8n endpoint + real client/subbie emails are **deferred** (the builder
  is not ready to put real recipient data in the system).
- **Telegram Bot API:** wired, not connected.
- **Anthropic API:** via the two Edge Functions only (key never in the browser).
- **Open-Meteo** (weather) and **OSM Nominatim** (geocoding): free, keyless.

---

## 11. Build, run, deploy

**Prereqs:** Node (repo uses `/opt/homebrew/bin/node`), a Supabase project, env vars.

**Env (`.env` for the app):**
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_WEBHOOK_BASE=...        # optional (n8n)
```
**Run locally:**
```
npm install
npm run dev -- --host        # Vite dev server
npm run build                # production build
npm run lint                 # eslint
```
**Deploy:** push to `main` → Vercel auto-builds/deploys. (Note: Vercel "Redeploy" reuses build
cache and won't pick up env changes — push a real commit.)

**DB changes:** SQL migration files live in the repo root (`supabase_*.sql`, each with a
`_rollback`). Applied by pasting into the Supabase SQL editor. `supabase_schema_ensure.sql` is
the idempotent "source of truth" for base tables.

---

## 12. Known gaps / tech debt (for the reviewer)
- **No TypeScript** — large JS surface (esp. `db.js`, `BuilderApp`, `VariationsModule`); no
  compile-time guarantees on data shapes.
- **No app server / all trust in RLS** — correctness of authorization == correctness of RLS
  policies. There are **multiple historical RLS layers** (`stage2`, `stage4`, `stage4b`,
  tenant phases, stage3a/b) and some **inconsistent policy naming** (`eot_read` vs
  `eot_claims_read`) — a consolidation/cleanup pass would reduce risk.
- **Residual `using(true)` policies** on ops tables (R6b) — review client/subcontractor exposure.
- **Storage not yet fully private** (R2) — existing objects need migrating under org prefixes
  before flipping the bucket private.
- **No app-side org context yet (tenancy Phase 4)** — the frontend doesn't yet establish/scope
  a "current org"; it leans on RLS. Multi-org users and org-scoped reads/Action-Queue are future.
- **Audit gaps** — `permission_denied` and `user_disabled` events not yet captured.
- **Inline styles everywhere** — no design system; styling is verbose and duplicated.
- **State-based navigation (no router)** — no deep-linkable URLs; back/forward semantics are
  manual.
- **Deferred:** Action Queue hourly email job (needs a runner + real recipient emails);
  real n8n/Telegram wiring; $ budget-vs-actual + productivity in Labour (needs pay-rate data).

---

## 13. Repository map (orientation)
```
src/
  App.jsx, main.jsx                 # entry + role routing
  components/{builder,office,supervisor,worker,subcontractor,client}/   # the 6 role apps
  components/shared/                # reusable feature modules + UI atoms
  lib/                              # db.js (data layer) + engines (actionQueue, timeline) + utils
  data/mockData.js                  # static reference data (categories, etc.)
supabase/functions/                 # extract-receipt, convert-variation (Deno Edge Functions)
supabase_*.sql                      # schema + migrations (+ _rollback files)
tests/
  *.spec.js                         # Playwright e2e
  sandbox/                          # multi-tenant security suite (seed/reset/isolation/rbac/audit)
  load/                             # k6 load tests
docs/                               # this file + multi-tenant design + security report
```

---

*Generated from the codebase 2026-06-10. For the security risk detail and live test results,
read `docs/SITE1_SANDBOX_SECURITY_REPORT.md`; for tenancy rationale,
`docs/SITE1_MULTI_TENANT_DESIGN.md`.*
