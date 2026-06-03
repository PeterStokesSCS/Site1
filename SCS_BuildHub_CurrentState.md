# SCS BuildHub — Current State Summary
_Generated 2026-06-03 by reading the full codebase. Reflects the live state of `/Users/peterstokes/Desktop/buildsafe-pro` at this point in development._

## At a glance
- **Live URL:** https://site1-zeta-one.vercel.app (auto-deploys from GitHub `PeterStokesSCS/Site1`, main branch)
- **Stack:** Vite 8 + React 19, inline styles, Supabase (Postgres + auth), n8n webhooks (wired, not connected), Telegram (wired, not connected)
- **Auth:** Real Supabase email/password. Role read from `profiles.role`. Dev role override via `?dev=true&role=<role>`.
- **Data layer:** `src/lib/db.js` wraps all Supabase reads/writes.
- **Build:** Compiles clean. One warning: JS bundle >500 kB (no code-splitting yet).

---

## 1. Component Inventory (every component, what it does)

### Root / infrastructure
| File | What it does | Data source |
|---|---|---|
| `src/main.jsx` | React entry point | — |
| `src/App.jsx` | Checks Supabase session, fetches profile, routes to one of 6 role apps. Renders `DevSwitcher` when `?dev=true`. Shows "No role assigned" fallback. | Supabase |
| `src/components/auth/LoginScreen.jsx` | Email/password sign-in, "forgot password" reset email, error states | Supabase auth |

### Builder (desktop console)
| File | What it does | Data source |
|---|---|---|
| `src/components/builder/BuilderApp.jsx` | Sidebar shell + 6 tabs. **Dashboard** (stat cards, project health cards), **Projects** (inline create-project form, live list), **Labour** (timesheet approval, approve-all), **Team** (list users, assign roles). Tabs **Variations / Safety / Reports** are placeholders ("Coming in Stage 3"). | **Supabase** |

### Supervisor (mobile tile grid) — most developed role
| File | What it does | Data source |
|---|---|---|
| `src/components/supervisor/SupervisorApp.jsx` | Shell: project header, tappable stat row (On Site / Tasks / Issues / Hazards), 9-tile grid. Holds inline screens for **Safety** (hazard register + report + resolve), **Daily Log** (submit + history), **Variations** (read-only list + totals), **Photos** (placeholder), **Chat** (team/trades/client channels). | **Supabase** (Safety/DailyLog/Variations/Chat); Photos placeholder |
| `src/components/supervisor/TasksFeature.jsx` | 3-tier: landing (My / Project / Others) → list (Overdue/Today/Upcoming/Completed sections, filters, add task) → detail (status, reassign, comments) | **Supabase** |
| `src/components/supervisor/IssuesFeature.jsx` | 3-tier: landing → list (4-level priority sections, filters incl. Safety, raise issue) → detail (resolve, escalate, comments). Raising with "safety related = YES" auto-creates a linked hazard record. | **Supabase** |
| `src/components/supervisor/OnSiteFeature.jsx` | Muster list (workers clocked in + visitors/subs), summary counts, worker detail (time on site, history, supervisor clock-out override), "+ Add" visitor/sub sign-in with SWMS/safety acknowledgement | **Supabase** |

### Worker (mobile tile grid)
| File | What it does | Data source |
|---|---|---|
| `src/components/worker/WorkerApp.jsx` | Shell + 6 tiles. **Start Day** (clock in/out, live timer, writes timesheet), **Tasks** (today's assigned, tap-complete), **Plans** (documents by category), **Safety** (report hazard). **Photos** and **Chat** tiles render nothing (no handler). | **Supabase** |

### Subcontractor (mobile tile grid)
| File | What it does | Data source |
|---|---|---|
| `src/components/subcontractor/SubcontractorApp.jsx` | Shell + 6 tiles. **Safety Sign-In** (SWMS + PPE tick, then confirmation), **Documents** list. Other tiles (Tasks, Chat, Compliance, Photos) have no screens. | **Mock data** + webhook |

### Client (mobile tile grid)
| File | What it does | Data source |
|---|---|---|
| `src/components/client/ClientApp.jsx` | Header with progress %, 6 tiles. **Updates** (progress + milestone tracker), **Documents**, **Variations** screens built. Schedule / Photos / Invoices tiles have no screens. | **Mock data** |

### Office Admin (desktop console)
| File | What it does | Data source |
|---|---|---|
| `src/components/office/OfficeAdminApp.jsx` | Sidebar + tabs. **Variations** (awaiting/approved lists), **Timesheets** (approve — local state only), **Clients** (per-project message thread — local state only). Documents / Schedule tabs are "Coming next". | **Mock data** |

### Shared components
| File | What it does |
|---|---|
| `src/components/shared/AppTile.jsx` | Reusable home-screen tile (icon, label, accent, badge count) |
| `src/components/shared/BackHeader.jsx` | Back-arrow header for sub-screens |
| `src/components/shared/ProjectHeader.jsx` | Brand + project identity (address-first + job number) + health pill + project switcher sheet. **⚠ switcher uses mock data — see bugs.** |
| `src/components/shared/DevSwitcher.jsx` | Floating ⇄ button to switch role (dev only) |
| `src/components/shared/LoadingScreen.jsx` | `LoadingScreen`, `Skeleton`, `CardSkeleton`, `EmptyState` helpers |
| `src/components/shared/OfflineBar.jsx` | Sticky banner when offline / syncing queued actions |

### Hooks
| File | Status |
|---|---|
| `src/hooks/useOfflineQueue.js` | **Used** — online/offline state + queue flush (Worker, Sub, OfflineBar) |
| `src/hooks/useWebhook.js` | **Unused / dead** |
| `src/hooks/useTelegram.js` | **Unused / dead** |

### Lib
| File | Status |
|---|---|
| `src/lib/supabase.js` | Supabase client. **Used everywhere.** |
| `src/lib/db.js` | Full Supabase data-access layer (projects, tasks, hazards, timesheets, daily logs, issues, variations, messages, documents, profiles). **Core of the app.** |
| `src/lib/webhook.js` | `post()` / `enqueue()` / offline queue to n8n. Used, but no-op until `VITE_WEBHOOK_BASE` set. |
| `src/lib/theme.js` | Colour tokens + tile definitions + health colours |
| `src/lib/auth.js` | Only exports `signOut()` now (auth moved into App.jsx) |
| `src/lib/telegram.js` | **Unused / dead** |
| `src/data/mockData.js` | Still the data source for Subcontractor, Client, Office, and the ProjectHeader switcher; also supplies `HAZARD_CATEGORIES` / `ISSUE_CATEGORIES` constants used by live Supabase views |

---

## 2. Working vs Partial vs Placeholder

### ✅ Fully working (real Supabase data, end-to-end)
- Login / logout / session routing / role assignment
- **Builder:** dashboard, create project, project list, timesheet approval, team role management
- **Supervisor:** Tasks (full 3-tier + comments + reassign), Issues (full 3-tier + safety link + escalate + comments), On Site (muster + worker detail + visitor/sub add), Safety (report/resolve hazards), Daily Log (submit + history), Chat (messages persist per channel)
- **Worker:** clock in/out (writes timesheets, live timer), today's tasks (tap-complete), plans (documents), report hazard
- Offline queue + offline banner

### 🟡 Partially built
- **Supervisor → Variations:** read-only (lists + totals); no create/price/approve/sign workflow yet
- **Builder → Variations / Safety / Reports tabs:** placeholder text only
- **Office Admin:** UI built but **Timesheets approve and Clients chat only mutate local state** — not persisted to Supabase; reads from mock data
- **Subcontractor → Safety Sign-In:** shows success but only POSTs to (unconnected) webhook — **does not write to `site_visits`**, so signed-in subs never appear on the Supervisor On Site muster
- **n8n webhooks:** every `post()` call is wired but `VITE_WEBHOOK_BASE` is empty, so all are silently skipped

### ⬜ Placeholder only (no functionality)
- Supervisor → Photos
- Worker → Photos, Chat tiles (no screen opens)
- Subcontractor → Tasks, Chat, Compliance, Photos tiles
- Client → Schedule, Photos, Invoices tiles
- Office → Documents, Schedule tabs
- Geofencing / GPS auto-clock-in / QR sign-in (specced in Part 1 but intentionally not built)

---

## 3. Known Bugs / Broken Features

1. **Project switcher shows mock projects (high impact).** `ProjectHeader.jsx` imports `mockProjects` and renders them in the switch-project sheet with mock IDs. Supervisor/Worker headers show the correct *real* project (passed via props), but tapping to switch lists the 3 hardcoded demo addresses (15 Beatrice St, Ringwood East, Clunes) and passes mock IDs that don't match Supabase — so switching projects is broken for real data. Should pull from `getProjects()`/`getProjectsByUser()`.

2. **Subcontractor sign-in doesn't persist.** `SubcontractorApp` sign-in only calls `post("/timeclock/in", …)` (no Supabase insert into `site_visits`). Subs therefore never show on the Supervisor On Site muster, despite the muster reading `site_visits`.

3. **Office Admin actions are not saved.** Timesheet approvals and client messages in `OfficeAdminApp` update React state only; nothing is written to Supabase, and the lists come from mock data.

4. **Client & Office run entirely on mock data** — they will look populated even for a brand-new account with no real projects, which is misleading.

5. **Worker "today's tasks" only shows tasks whose `due_date` is exactly today** and `assignee_id` = the worker. Tasks created without a due date, or dated other days, silently won't appear.

6. **All n8n automations are inert** until `VITE_WEBHOOK_BASE` is set in `.env` / Vercel. By design, but worth stating: no Telegram alerts, no payroll export, no client emails currently fire.

7. **Performance note (not a bug):** single JS bundle ~543 kB (gzip ~139 kB); Vite warns to code-split.

---

## 4. Current File Structure

```
buildsafe-pro/
├─ index.html
├─ package.json            (deps: @supabase/supabase-js, react 19, react-dom 19)
├─ vite.config.js          (server.allowedHosts: true — for ngrok/preview)
├─ supabase_schema.sql     (Stage 1 base schema — 13 tables + RLS)
├─ supabase_migration_part1.sql  (GPS, gps_consent, 4-level priority,
│                                 task_comments, issue_comments, site_visits,
│                                 issue<->hazard link)
├─ .env                    (Supabase URL + anon key; webhook/telegram blank) [gitignored]
├─ SCS_BuildHub_CurrentState.md   (this file)
└─ src/
   ├─ main.jsx
   ├─ App.jsx              (Supabase auth + 6-role router)
   ├─ index.css  App.css
   ├─ assets/             (default Vite assets — unused by app UI)
   ├─ components/
   │  ├─ auth/LoginScreen.jsx
   │  ├─ builder/BuilderApp.jsx
   │  ├─ supervisor/
   │  │  ├─ SupervisorApp.jsx
   │  │  ├─ TasksFeature.jsx
   │  │  ├─ IssuesFeature.jsx
   │  │  └─ OnSiteFeature.jsx
   │  ├─ worker/
   │  │  ├─ WorkerApp.jsx          (ACTIVE)
   │  │  ├─ ClockInOut.jsx         (ORPHANED — superseded)
   │  │  ├─ TodaysTasks.jsx        (ORPHANED)
   │  │  ├─ ReportHazard.jsx       (ORPHANED)
   │  │  ├─ MyTimesheets.jsx       (ORPHANED)
   │  │  └─ RequestMaterials.jsx   (ORPHANED)
   │  ├─ subcontractor/SubcontractorApp.jsx
   │  ├─ client/ClientApp.jsx
   │  ├─ office/OfficeAdminApp.jsx
   │  ├─ manager/                  (ENTIRE FOLDER ORPHANED — old 3-role app)
   │  │  ├─ ManagerApp.jsx  Dashboard.jsx  Projects.jsx
   │  │  ├─ Safety.jsx  Schedule.jsx  ClientPortal.jsx
   │  └─ shared/
   │     ├─ AppTile.jsx  BackHeader.jsx  ProjectHeader.jsx
   │     ├─ DevSwitcher.jsx  LoadingScreen.jsx  OfflineBar.jsx
   ├─ hooks/
   │  ├─ useOfflineQueue.js        (ACTIVE)
   │  ├─ useWebhook.js             (ORPHANED)
   │  └─ useTelegram.js            (ORPHANED)
   ├─ lib/
   │  ├─ supabase.js  db.js  webhook.js  theme.js  auth.js
   │  └─ telegram.js              (ORPHANED)
   └─ data/mockData.js
```

### Dead / orphaned code (safe to delete, not imported anywhere)
- `src/components/manager/` — all 6 files (legacy "BuildSafe Pro" 3-role manager app)
- `src/components/worker/ClockInOut.jsx`, `TodaysTasks.jsx`, `ReportHazard.jsx`, `MyTimesheets.jsx`, `RequestMaterials.jsx` (superseded by inline screens in `WorkerApp.jsx`)
- `src/hooks/useWebhook.js`, `src/hooks/useTelegram.js`
- `src/lib/telegram.js`
- `src/assets/` default Vite art

---

## 5. Deviations from the Original Project Summary

The original `SCS_BuildHub_ProjectSummary.md` described an earlier shape of the app. What has changed since:

1. **Rebrand + role model.** "BuildSafe Pro" with 3 roles (manager / worker / client) → "SCS BuildHub" with **6 roles** (builder, supervisor, worker, subcontractor, client, office). The original **manager app still physically exists** in `src/components/manager/` but is fully orphaned.

2. **Backend added.** Original said "no custom backend / n8n only." The app now has a **real Supabase backend** (Postgres, auth, 13+ tables, RLS) as the primary datastore. n8n is demoted to an automation layer that isn't connected yet.

3. **Real auth.** Original used a `?role=` URL hack. Now: real Supabase email/password login; role comes from the database. The URL hack survives only behind `?dev=true`.

4. **Project identity.** Switched to **address-first + job number** ("JOB SCS-001 · 15 Beatrice Street") per the design sketch.

5. **Data migration is incomplete.** Builder, Supervisor and Worker are on Supabase. **Subcontractor, Client and Office are still on `mockData.js`** — a deviation from the implied "all live data" end state.

6. **Supervisor depth.** Tasks and Issues went well beyond the original flat lists — now 3-level (landing → list → detail) with comments, reassignment, escalation, and a bidirectional issue↔hazard safety link, per `SCS_BuildHub_FeatureSpec_Part1.md`.

7. **New On Site feature** (muster / visitor sign-in) exists that wasn't in the original summary.

8. **Specced-but-not-built:** GPS geofencing, auto-clock-in, and QR sub sign-in from Feature Spec Part 1 are deliberately deferred (need native location permissions).

---

## Suggested cleanup / next priorities (not yet done)
- Fix the **ProjectHeader switcher** to use real projects (bug #1)
- Persist **Subcontractor sign-in** to `site_visits` (bug #2) so subs hit the muster
- Migrate **Client / Office / Subcontractor** off mock data onto Supabase
- Delete orphaned `manager/`, old worker files, dead hooks/lib
- Decide on n8n: set `VITE_WEBHOOK_BASE` and build the flows, or defer
