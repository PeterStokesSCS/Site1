# SCS BuildHub — Field Test Feedback Log (Alpha Test 01)
_Tester: Peter Stokes · Roles tested: Builder & Supervisor · Logged 2026-06-03_

> **The backbone insight:** almost every module should connect back through
> **Project → Project Dashboard → Specific Function.** This project-centric
> navigation is the architectural spine and is the single most important
> missing piece.

---

## Status key
- ✅ Done this session · 🟡 In progress · ⬜ Not started

---

## CRITICAL
| # | Item | Area | Status |
|---|---|---|---|
| C1 | **Task creation fails / saves nothing** | Supervisor → Tasks | ✅ Fixed (empty-string UUID + swallowed error) |
| C2 | **Project Dashboard navigation** — clicking a project (Builder *and* Supervisor) opens a dedicated Project Dashboard: Overview, Plans, Daily Logs, Tasks, Safety, Variations, Photos, Communication, Financials | Builder → Projects | ⬜ |
| C3 | **On Site sign-out** — each on-site person gets a SIGN OUT action → confirmation dialog → review/adjust time → confirm; system calculates total hours | Supervisor → On Site | ⬜ |
| C4 | **Variations as a legally defensible record** — timestamp, user, photos, attachments, scope, cost impact, client approval, digital signature, approval date, revision history | Commercial | ⬜ |

## HIGH
| # | Item | Area | Status |
|---|---|---|---|
| H1 | Builder dashboard tiles clickable → Active Projects (filtered list), Approvals (approvals dashboard), At Risk (red projects), Attention (amber projects) | Builder → Dashboard | ⬜ |
| H2 | Rename **Variations → Commercial**; columns: Contracts, Purchase Orders, Quotes, Invoices, Receipts, Variations, Cost Tracking — each opens its own page (Approved / Pending / Revision Required, by project) | Builder | ⬜ |
| H3 | **Team** restructured: Internal Staff / Subcontractors / Suppliers, with filter | Builder → Team | ⬜ |
| H4 | **Team member detail page** — contact, address, licences, certificates, qualifications, emergency contact; history: projects, dates, hours, site history; future: productivity & estimating data | Builder → Team | ⬜ |
| H5 | **Persist last viewed project** — Supervisor reopens app on the project they were last on | Supervisor | ⬜ |
| H6 | **Current project indicator** — top corner: project + ON SITE + live timer (green); OFF SITE shows last project (red). Prevents wrong timesheet records | Supervisor | ⬜ |
| H7 | **Project-specific metrics** — On Site / Tasks Due / Issues / Hazards must reflect the selected project only, not company-wide | Supervisor | ⬜ (verify — believed already project-scoped) |
| H8 | **Supplier/sub auto-complete** on the On Site Company field | Supervisor → On Site | ⬜ |
| H9 | **Self sign-out sync** — sub signing out on their own login reflects on supervisor muster | On Site | ⬜ |
| H10 | **On Site history** — Today / History tabs; History = calendar selector → date, attendees, hours, visitor records | Supervisor → On Site | ⬜ |
| H11 | **Task fields** — add Due Time, attachments (photos / PDFs / drawings). Structure: Title, Assigned To, Priority, Date, Time, Description, Attachments | Tasks | ⬜ |
| H12 | Daily Log worker numbers auto-populate from On Site attendance (supervisor confirms) | Daily Log | ⬜ |
| H13 | **Daily Log question-based workflow** — Deliveries? Visitors? Issues/Delays? each YES/NO; NO auto-records "No X", YES opens detail | Daily Log | ⬜ |
| H14 | **Daily Log attendance review** before submit — confirm workers/subs/visitors | Daily Log | ⬜ |
| H15 | **Daily Log history** — list newest-first, filters Day/Week/Month, search | Daily Log | ⬜ |

## MEDIUM
| # | Item | Area | Status |
|---|---|---|---|
| M1 | **Labour tab** redefined as workforce/reporting: Timesheets, Attendance, Labour Allocation, Budget vs Actual, Productivity | Builder → Labour | ⬜ (design needed) |
| M2 | **Supervisor profile button** (orange avatar) opens a personal Supervisor Dashboard: assigned tasks, outstanding actions, upcoming inspections, team notifications, personal timesheets, approvals — separate from project items | Supervisor | ⬜ |
| M3 | **Weather API** in Daily Log — forecast, temp, rainfall, conditions (replaces manual) | Daily Log | ⬜ |

## LOW
| # | Item | Area | Status |
|---|---|---|---|
| L1 | Rename **Other Tasks → Team Tasks** | Tasks | ⬜ |

---

## Detailed notes (verbatim intent)

### Builder
- Dashboard layout is liked — no redesign. Just make the 4 summary tiles clickable (H1).
- Projects list is good but **dead-ends** — clicking must open a Project Dashboard (C2). This is the #1 gap.
- Labour tab purpose unclear — likely move timesheets into a financial/workforce area (M1).
- Variations → **Commercial** hub with category columns (H2); each category lists items by status and project, linking back to the project (C2).
- Variations themselves need full legal record + signing (C4).
- Team = internal + subbies + suppliers w/ filter (H3); each person has a rich detail + history page (H4) for warranty, movement records, and future estimating from labour-hours-per-task.

### Supervisor
- Reopen on last project (H5); show a live on-site indicator top corner (H6).
- The orange avatar → personal supervisor dashboard across all jobs (M2); project-scoped items stay below the selected project.
- Metrics tied to selected project only (H7).
- On Site: sign-out per person w/ confirm + time calc (C3); company autocomplete (H8); self sign-out sync (H9); Today/History tabs w/ calendar (H10).
- Tasks: date **and** time, attachments (H11); rename Other→Team (L1). (Creation bug C1 fixed.)
- Daily Log: weather API (M3); auto worker count (H12); YES/NO question workflow (H13); attendance review before submit (H14); history list w/ filters + search (H15).

---

## Recommended build sequence
1. **Quick, self-contained wins** (low risk, immediately testable): C3 On-Site sign-out, H1 dashboard tile links, H5 persist last project, H6 current-project indicator, L1 rename, H11 task time+attachments.
2. **The keystone:** C2 Project Dashboard navigation — Builder clicks a project → full project dashboard, reusing the supervisor's project-scoped screens. Re-architects the app around Project → Dashboard → Function.
3. **Big modules** (separate builds): H2/C4 Commercial + Variations legal record; H3/H4 Team module + detail; H13–H15 Daily Log redesign; M3 Weather API; M1 Labour; M2 Supervisor personal dashboard.
