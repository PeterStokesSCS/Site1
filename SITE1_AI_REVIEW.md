# SITE1 — AI Code & Architecture Review Brief

**Generated:** 2026-06-08
**Repo:** `~/Desktop/buildsafe-pro` · GitHub `PeterStokesSCS/Site1` · Prod `https://site1-zeta-one.vercel.app`
**Audience:** an AI (or engineer) doing a code/architecture/security review.
**Companion docs:** `SITE1_CURRENT_WORKFLOW.md` (UX/behaviour, role-by-role), `SITE1_DATA_DICTIONARY.md` (tables), `SITE1_BUILD_INVENTORY.md`, `SCS_BuildHub_FieldTestFeedback_Alpha01.md` (the alpha backlog — now 100% cleared).

> **What this is.** SITE1 is a construction operating system for a small Melbourne builder (Stokes Construction Services). Single-page React app, Supabase backend, deployed on Vercel. ~10.4k LOC across `src/`. The product principle: **the Project is the centre of everything** — almost every action happens inside a project, reached via a shared **Project Dashboard**.

---

## 1. How to run / verify

```bash
export PATH="/opt/homebrew/bin:$PATH"      # node lives in homebrew
npm install
npm run dev -- --host                       # local dev
npm run build                               # production build (must be clean)
npm run test:unit                           # vitest — 51 tests, all green
npm test                                    # Playwright e2e (needs creds; auth specs skip without them)
```

- **Unit tests:** `src/lib/actionQueue.test.js` (13) + `src/lib/timeline.test.js` (38) = **51 green**. `vitest.config.js` excludes the Playwright `tests/` dir.
- **e2e:** `tests/smoke.spec.js` + `tests/core-flows.spec.js`. Auth-gated specs **skip** without `tester@site1demo.com` creds in env; the 2 unauthenticated smoke tests run anywhere.
- **No SQL is required for anything except the most recent Labour pay-rates feature** — see §6.

---

## 2. Stack & conventions

- **Vite 8 + React 19**, JSX, **no TypeScript**.
- **Inline styles only** (no CSS framework). Dark theme: base `#0c0c0c`, accent orange `#e07b39`. Fonts: Barlow Condensed (headings), DM Sans (body).
- **No URL router.** Navigation is component state (`setScreen`/`setTab`/`openProject`). Deep-links use "navigation intents" `target:{kind, projectId, entityId}` mapped through `KIND_TO_PROJECT_SCREEN` in `actionQueue.js`.
- **Supabase** = Postgres + Auth + Storage + Edge Functions. Data layer is `src/lib/db.js` (every query goes through it). Client in `src/lib/supabase.js`.
- **Melbourne timezone** is the canonical TZ; date-only math uses UTC `T00:00:00Z` to avoid local shift bugs (see `timeline.js`).

### Review asks for §2
- Inline-styles-everywhere is a deliberate constraint, not an oversight — don't recommend a CSS migration. Flag genuinely **duplicated style objects** that should be shared constants if egregious.
- `db.js` is large and central; flag any query that **bypasses RLS assumptions** or lacks the member/owner scoping the rest follow.

---

## 3. Architecture map

### Entry / shell
- `src/lib/auth.js` resolves the session + role; the role selects one of six **role apps**. `?dev=true` exposes a `DevSwitcher` (gated to real builder/office only).
- Six role apps: `builder/BuilderApp.jsx` (desktop console), `supervisor/SupervisorApp.jsx`, `worker/WorkerApp.jsx`, `subcontractor/SubcontractorApp.jsx`, `client/ClientApp.jsx`, `office/OfficeAdminApp.jsx`.

### The spine: Project Dashboard
- `shared/ProjectDashboard.jsx` — one component shared by **builder and supervisor**. Renders a grouped tile grid (Site / Quality & Programme / Commercial / Project) → each tile opens a feature screen via an internal `switch`. Builder reaches it by tapping a project card; supervisor lands on it.
- Feature screens (mostly shared): `TasksFeature`, `IssuesFeature`, `OnSiteFeature`, `SafetyScreen`/`DailyLogScreen`/`ChatScreen` (in `SupervisorScreens.jsx`), `OverviewScreen`, `CommercialModule`, `VariationsModule`, `PhotosScreen`, `ProjectDocsScreen`, `TimelineScreen`/`LookaheadScreen`, `InspectionsModule`, `DefectsModule`, `ProcurementModule`, `PurchaseOrdersModule`.

### Cross-cutting engines (in `src/lib/`)
- **Action Queue** (`actionQueue.js` + `shared/ActionQueue.jsx`): a derived "what needs doing" layer, **computed-on-read, never stored**, auto-resolves when source state changes. A predicate `REGISTRY` filtered by role; Melbourne-TZ helpers; nav-intent targets. `useActionItems(role,userId)` hook. Surfaced to every role (builder company queue, supervisor "My actions today" + personal dashboard, client/subby cards).
- **Timeline Engine** (`timeline.js`): VIC stage-milestone skeleton; baseline (`planned_date`) + `forecast_date` **persisted**, status/variance/risk **derived**. Pure rule logic with anti-false-alarm (missing input → emit nothing). `MODULES` feature flags gate risk rules: `{procurement:true, inspections:true, labour:false}`.
- **Photos** (`photoUtils.js`, `photoQueue.js`, `storage.js`, `shared/Photo*.jsx`): GPS+compression capture, record linking, client-visible gating, categories, IndexedDB offline outbox with auto-flush.
- **Variations/Commercial** (`variationCalc.js`, `variationPdf.js`): line-item pricing (margin% / direct), GST, EOT, auto-numbering, running contract sum, letterhead PDF (jsPDF+html2canvas lazy-loaded), revision control, audit trail. Legal sign-off in client app.
- **Integrations:** `ai.js` (two deployed Edge Functions: `extract-receipt`, `convert-variation`), `webhook.js` (n8n events as CORS-simple `text/plain` POSTs — no preflight), `weather.js` (Open-Meteo, no key), `geocode.js`.

### Review asks for §3
- The Action Queue is the most novel piece. Review `computeActionItems` and the predicate registry for: predicates that could **throw and break the whole queue** (each is `.catch(()=>[])`-guarded — verify none slipped through), and predicates that scan **across all projects** unintentionally vs. respecting membership.
- Verify the **derived-never-stored** invariant holds — nothing should be persisting Action Queue items or milestone status/variance.

---

## 4. Security posture (review priority)

- **RLS hardening** was the production blocker and is largely done. History: everything started `for all using(true)`; Stage 2 = scoped reads, Stage 4a/4b = scoped writes (member-or-admin + ownership clauses for subbie/author-owned tables). Scripts: `supabase_rls_stage2*.sql`, `supabase_rls_stage4*.sql`.
- **Known RLS limitation (Stage 3, NOT done):** Postgres RLS is **row-level**, so it cannot hide a single *column* from someone who may read the row. Confidential **financial columns** (margins, costs) on otherwise-readable tables are therefore not yet protected via views. This is the main open security item. UI gates money/margin to builder/office, but that is **client-side only**.
- **Pay rates (new, §6):** because of the row-vs-column limitation above, worker pay rates were deliberately **NOT** added as a column on `profiles` (which workers/supervisors read for names). They live in a separate **`labour_rates`** table whose RLS restricts all access to builder/office. This is the pattern Stage 3 should generalise.
- **Tester account caveat:** `tester@site1demo.com` is a **builder (admin)**. Green Playwright runs only prove the **admin** path — they do **not** verify non-admin RLS. Real verification requires logging in as a non-admin with memberships, no `?dev`.
- **Secrets:** API keys live only in Supabase / Vercel env — never in code, chat, or git. `VITE_WEBHOOK_BASE` is the only client-exposed integration var (currently a webhook.site test inbox; real recipient emails deliberately deferred — owner not ready for real client/subby data).

### Review asks for §4
- **Highest value:** audit each RLS policy in `supabase_schema_ensure.sql` + the stage scripts for tables where a non-admin could read another party's rows or financial columns. Confirm `labour_rates` policy truly blocks non-admins (read **and** write).
- Flag any **client-side-only** authorization that a determined non-admin could bypass via the Supabase JS client directly (the financial-column gating is the known one — look for others).
- Check the `?dev` role-switch gating can't be abused to assume admin.

---

## 5. Data model

`supabase_schema_ensure.sql` is the **single idempotent source of truth** (re-runnable; `add column if not exists` throughout). Re-run it whenever a column/table is added. Key tables: `profiles`, `projects`, `project_members`, `tasks`, `hazards`, `issues`, `timesheets`, `site_visits`, `daily_logs`, `variations` (rich legal record), `purchase_orders`, `commercial_items` (one table, `type` column for contracts/POs/quotes/invoices/receipts), `milestones` (+ `forecast_changes`), `procurement_items`, `qa_items`, `defects`, `subbie_requests`, `profile_credentials`, `notification_log`, **`labour_rates`** (new). `documents`/`photos` for files.

### Review asks for §5
- `commercial_items` uses a `type`-discriminated single table — review whether any query forgets to filter by `type` and leaks cross-category rows.
- `variations` carries the legal record (audit_trail jsonb, revision_history jsonb, signature fields, approval IP/device). Review the **revision/supersede** logic in `VariationsModule.jsx` (`revise()`) for orphan/loop risks.

---

## 6. What changed most recently (this session — review these first)

All committed to `main`, builds clean, 51/51 unit tests. **Only the last item needs a SQL migration.**

| Area | Change | Files |
|---|---|---|
| On-Site | Company autocomplete (datalist), subby **self-sign-out** syncing to muster, history **date picker** | `supervisor/OnSiteFeature.jsx`, `subcontractor/SubcontractorApp.jsx` |
| Supervisor | **Personal dashboard** (orange avatar → cross-project actions / my-time / my-tasks) | `supervisor/SupervisorDashboard.jsx`, `shared/ProjectHeader.jsx`, `db.js` (`getMyTasks`/`getMyTimesheets`) |
| Builder nav | Project drill-in made first-class: project-centric header + **in-context project switcher** | `builder/BuilderApp.jsx`, `shared/ProjectHeader.jsx` |
| Tasks | Creating a task opens its detail so **attachments** attach immediately | `supervisor/TasksFeature.jsx` |
| Variations | **Drawn-signature pad** (canvas) → existing `signature_image` column, rendered on PDF + client view | `client/ClientApp.jsx`, `shared/VariationsModule.jsx` |
| Commercial | Category pages get **Approved/Pending/Revision/Draft** filters; standalone Variations tile folded into Commercial | `shared/CommercialModule.jsx`, `shared/ProjectDashboard.jsx` |
| Labour | Labour tab → **workforce hub**: Timesheets · Attendance · Allocation · Hours report | `builder/LabourHub.jsx`, `db.js` |
| Team | **Suppliers** directory derived from `commercial_items.vendor` | `builder/BuilderApp.jsx`, `db.js` (`getAllCommercialItems`) |
| Labour **(needs SQL)** | **Budget vs Actual**: per-project labour budget vs actual cost (hours × rate); confidential rates in `labour_rates` | `builder/LabourHub.jsx`, `db.js` (`getLabourRates`/`upsertLabourRate`), `supabase_migration_labour_rates.sql`, `projects.labour_budget` |

**Migration to run for the last row:** `supabase_migration_labour_rates.sql` (creates `labour_rates` w/ builder/office RLS + adds `projects.labour_budget`). The UI degrades gracefully before it runs (amber prompt, no crash, saves don't persist).

### Review asks for §6
- `LabourHub.jsx` `BudgetView`: verify cost math (`Σ hours × rate` per project) and that **rates are never rendered to non-builder roles** (the hub is builder-console-only — confirm there's no leak path).
- Confirm `upsertLabourRate` `onConflict: "profile_id"` matches the table's unique constraint.

---

## 7. Deliberately NOT built / deferred (don't flag as bugs)

- **$ Productivity** metric and any cost roll-up into Commercial → Cost Tracking (rates only just landed).
- **Action Queue Phase 4** (hourly email job) — needs real recipient emails the owner isn't ready to add; idempotency table `notification_log` already exists.
- **RLS Stage 3** (financial-column confidentiality via views) — known, see §4.
- **`MODULES.labour=false`** — the labour double-booking rule + a scheduled-allocation roster table are intentionally off (current Allocation view is derived from `project_members` + open timesheets, not a roster).
- **task↔procurement linking** UI (start_date + `depends_on_procurement_ids` picker) needed to fully activate the `material_not_on_site` rule.
- Real n8n endpoint + real client/subby emails — deferred; webhook currently points at a test inbox.

---

## 8. Top review questions (please prioritise)

1. **RLS correctness** — can any non-admin read another party's rows or financial columns? (§4) Is `labour_rates` truly admin-only?
2. **Client-side-only authorization** — list every place money/margin/rates are gated only in React and thus bypassable via the raw Supabase client.
3. **Action Queue safety** — any predicate that can throw past its guard, scan beyond a user's projects, or accidentally persist derived state? (§3)
4. **Variations legal record** — revision/supersede integrity; is the sign-off metadata (typed name + drawn image + IP/device + statement) captured atomically? (§5/§6)
5. **Data-layer consistency** — any `db.js` query missing the member/owner scoping the rest follow, or a `commercial_items` query missing its `type` filter? (§2/§5)
6. **Single-file size** — `BuilderApp.jsx`, `VariationsModule.jsx`, `db.js` are large; flag the highest-value extractions only.
