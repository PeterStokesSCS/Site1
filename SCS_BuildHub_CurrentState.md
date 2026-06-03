# SCS BuildHub — Current State Summary
_Last regenerated 2026-06-03 (after the Supabase-migration + cleanup session). Reflects the live state of `/Users/peterstokes/Desktop/buildsafe-pro`._

## At a glance
- **Live URL:** https://site1-zeta-one.vercel.app (auto-deploys from GitHub `PeterStokesSCS/Site1`, branch `main`)
- **Stack:** Vite 8 + React 19, inline styles, Supabase (Postgres + auth) as primary datastore, n8n webhooks (wired, not connected), Telegram (removed from code).
- **Auth:** Real Supabase email/password. Role read from `profiles.role`. Dev role override via `?dev=true&role=<role>`.
- **Data layer:** `src/lib/db.js` wraps all Supabase reads/writes.
- **Headline change since last summary:** **all 6 roles now run on real Supabase data.** `mockData.js` is reduced to two constant lists (`HAZARD_CATEGORIES`, `ISSUE_CATEGORIES`). Orphaned legacy code deleted.

---

## 1. Component Inventory

### Root / infrastructure
| File | What it does | Data |
|---|---|---|
| `src/main.jsx` | React entry point | — |
| `src/App.jsx` | Supabase session check, fetch profile, route to one of 6 role apps; `DevSwitcher` when `?dev=true`; "No role assigned" fallback | Supabase |
| `src/components/auth/LoginScreen.jsx` | Email/password sign-in + forgot-password reset | Supabase auth |

### Builder (desktop console)
| File | What it does | Data |
|---|---|---|
| `src/components/builder/BuilderApp.jsx` | Sidebar shell + tabs. **Dashboard** (stat cards, project health cards), **Projects** (inline create-project form + live list), **Labour** (timesheet approval + approve-all), **Team** (list users, assign roles). **Variations / Safety / Reports** tabs are placeholders. | **Supabase** |

### Supervisor (mobile tile grid) — most developed role
| File | What it does | Data |
|---|---|---|
| `src/components/supervisor/SupervisorApp.jsx` | Shell: project header (real switcher), tappable stat row (On Site / Tasks / Issues / Hazards), 9-tile grid. Inline screens: **Safety** (hazard register + report + resolve), **Daily Log** (submit + history), **Variations** (read-only list), **Photos** (placeholder), **Chat** (team/trades/client channels). | **Supabase** |
| `src/components/supervisor/TasksFeature.jsx` | 3-tier: landing (My/Project/Others) → list (Overdue/Today/Upcoming/Completed) → detail (status, reassign, comments) | **Supabase** |
| `src/components/supervisor/IssuesFeature.jsx` | 3-tier landing → list (4-level priority, Safety filter, raise) → detail (resolve, escalate, comments). Safety toggle auto-creates a linked hazard. | **Supabase** |
| `src/components/supervisor/OnSiteFeature.jsx` | Muster (workers clocked in + visitors/subs), worker detail (time on site, history, supervisor clock-out), add visitor/sub sign-in | **Supabase** |

### Worker (mobile tile grid)
| File | What it does | Data |
|---|---|---|
| `src/components/worker/WorkerApp.jsx` | Shell + 6 tiles. **Start Day** (clock in/out, live timer, writes timesheet), **Tasks** (today's, tap-complete), **Plans** (documents), **Safety** (report hazard). **Photos / Chat** tiles have no screen. | **Supabase** |

### Subcontractor (mobile tile grid)
| File | What it does | Data |
|---|---|---|
| `src/components/subcontractor/SubcontractorApp.jsx` | Loads real projects (switchable). **Safety Sign-In** writes to `site_visits` → appears on Supervisor muster. **Documents** live. Tasks / Chat / Compliance / Photos tiles have no screen. | **Supabase** |

### Client (mobile tile grid)
| File | What it does | Data |
|---|---|---|
| `src/components/client/ClientApp.jsx` | Resolves project via `project_members` (fallback to RLS-visible). **Updates** (progress % + milestones from DB), **Documents**, **Variations** (pending badge). Schedule / Photos / Invoices are honest "coming soon" screens. | **Supabase** |

### Office Admin (desktop console)
| File | What it does | Data |
|---|---|---|
| `src/components/office/OfficeAdminApp.jsx` | Sidebar + tabs. **Variations** (approve/reject persist), **Timesheets** (approve persists), **Clients** (real per-project message threads), **Documents** (grouped by project). Schedule tab = placeholder. | **Supabase** |

### Shared
| File | Role |
|---|---|
| `AppTile.jsx` | Home-screen tile (icon, label, badge) |
| `BackHeader.jsx` | Back-arrow header for sub-screens |
| `ProjectHeader.jsx` | Brand + project identity + health pill + **switcher (now uses real projects)** |
| `DevSwitcher.jsx` | Floating ⇄ role switch (dev only) |
| `LoadingScreen.jsx` | `LoadingScreen`, `Skeleton`, `CardSkeleton`, `EmptyState` |
| `OfflineBar.jsx` | Offline / syncing banner |

### Hooks / lib / data
| File | Role |
|---|---|
| `hooks/useOfflineQueue.js` | Online/offline state + queue flush (used) |
| `lib/supabase.js` | Supabase client |
| `lib/db.js` | **Full data-access layer.** ~30 functions incl. `getAllVariations`, `updateVariationStatus`, `getAllDocuments`, `getMilestones`, `getProjectsByUser` |
| `lib/webhook.js` | `post()` / `enqueue()` / offline queue to n8n (no-op until `VITE_WEBHOOK_BASE` set) |
| `lib/theme.js` | Colour tokens, tile defs, health colours |
| `lib/auth.js` | `signOut()` helper |
| `data/mockData.js` | **Now only exports `HAZARD_CATEGORIES` + `ISSUE_CATEGORIES`** constants |

---

## 2. Working vs Partial vs Placeholder

### ✅ Fully working on Supabase (end-to-end)
- Login / logout / session routing / role assignment
- **Builder:** dashboard, create project, project list, timesheet approval, team role management
- **Supervisor:** Tasks (3-tier + comments + reassign), Issues (3-tier + safety link + escalate), On Site (muster + worker detail + visitor/sub add), Safety, Daily Log, Chat
- **Worker:** clock in/out, today's tasks, plans, report hazard
- **Subcontractor:** safety sign-in (persists to muster), documents
- **Client:** progress + milestones, documents, variations
- **Office Admin:** variations approve/reject, timesheet approval, client messaging, documents
- Offline queue + banner

### 🟡 Partial
- **Variations have no create/price/sign workflow yet** — Supervisor view is read-only; Builder/Office can approve/reject but nothing raises them in-app (so these screens are empty until rows exist)
- **Builder → Variations / Safety / Reports tabs:** placeholder text
- **n8n webhooks:** every `post()` is wired but `VITE_WEBHOOK_BASE` is empty → all silently skipped (no Telegram/email/payroll yet)

### ⬜ Placeholder / not built
- Photos everywhere (Supervisor/Worker/Sub/Client) — needs Supabase Storage
- Chat tiles on Worker & Subcontractor (Supervisor chat works)
- Subcontractor: Tasks, Compliance tiles
- Client: Schedule, Photos, Invoices (honest "coming soon")
- Office: Schedule tab
- Geofencing / GPS auto-clock-in / QR sign-in (specced, deferred)

---

## 3. Known Bugs / Gaps

All three bugs from the previous summary are **fixed** (project switcher, subcontractor sign-in persistence, dead code). Remaining gaps:

1. **No UI to link a user to a project (functional gap, not a crash).** Clients and team members only see a project if a `project_members` row exists, which currently must be added manually in Supabase. A client with no link sees "No project linked yet"; a worker/supervisor with no link falls back to all RLS-visible projects. **This is the main thing to address next** — a "assign user to project" action in the Builder console.
2. **Empty-looking screens are now honest, not broken.** Variations/most lists start empty because there's no real data yet — expected, but worth knowing when testing.
3. **n8n automations inert** until `VITE_WEBHOOK_BASE` is set.
4. **Worker "today's tasks"** only shows tasks with `due_date` = today AND `assignee_id` = the worker.
5. **Document "client-visible" filtering** not implemented — clients currently see all non-superseded docs for their project (spec wants a client-visible flag).
6. **Perf:** single JS bundle ~550 kB (no code-splitting). Warning only.

> ⚠️ **Untested on device:** the entire Supabase migration of Subcontractor / Office / Client and the bug fixes have been build-verified but **not yet tested by Pete on a real phone/browser.** Recommend a full click-through before new feature work.

---

## 4. Current File Structure

```
buildsafe-pro/
├─ index.html  vite.config.js  package.json
├─ supabase_schema.sql            (base: 13 tables + RLS)
├─ supabase_migration_part1.sql   (GPS, gps_consent, 4-level priority,
│                                   task_comments, issue_comments,
│                                   site_visits, issue<->hazard link)
├─ .env  [gitignored]             (Supabase URL + anon key; webhook blank)
├─ SCS_BuildHub_CurrentState.md   (this file)
└─ src/
   ├─ main.jsx  App.jsx  index.css
   ├─ components/
   │  ├─ auth/LoginScreen.jsx
   │  ├─ builder/BuilderApp.jsx
   │  ├─ supervisor/{SupervisorApp,TasksFeature,IssuesFeature,OnSiteFeature}.jsx
   │  ├─ worker/WorkerApp.jsx
   │  ├─ subcontractor/SubcontractorApp.jsx
   │  ├─ client/ClientApp.jsx
   │  ├─ office/OfficeAdminApp.jsx
   │  └─ shared/{AppTile,BackHeader,ProjectHeader,DevSwitcher,LoadingScreen,OfflineBar}.jsx
   ├─ hooks/useOfflineQueue.js
   ├─ lib/{supabase,db,webhook,theme,auth}.js
   └─ data/mockData.js   (constants only)
```
**26 source files** (down from 39 — the legacy `manager/` app, old worker screens, dead hooks and `telegram.js` were removed this session). No orphaned files remain.

---

## 5. Deviations from the Original Project Summary

1. **Rebrand + 6 roles.** "BuildSafe Pro" 3-role → "SCS BuildHub" 6-role (builder, supervisor, worker, subcontractor, client, office). Legacy manager app **removed entirely**.
2. **Supabase backend** is now the source of truth for **every** role (original implied n8n-only / partial mock).
3. **Real auth** (was a `?role=` hack; now behind `?dev=true` only).
4. **Address-first project identity** + job number.
5. **Supervisor depth** far beyond original: 3-level Tasks/Issues, comments, escalation, bidirectional issue↔hazard safety link (per Feature Spec Part 1).
6. **On Site** muster/visitor sign-in feature added.
7. **Deferred:** GPS geofencing, auto-clock-in, QR sub sign-in (need native location permissions).

---

## Recommended next steps (in order)
1. **Device test** the full app across all 6 roles (nothing here has been hand-tested since the migration).
2. **Build "assign user to project"** in the Builder console (closes gap #1 — needed for clients/team to see anything).
3. Decide on **Variations create workflow** (so those screens have data) and/or **Part 2 feature spec**.
4. Optional: set `VITE_WEBHOOK_BASE` + build n8n flows when ready.
