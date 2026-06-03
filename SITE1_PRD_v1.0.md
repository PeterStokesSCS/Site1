# SITE1 — Product Requirements Document (PRD)
### Version 1.0 · Owner: Peter Stokes · Stokes Construction Services
### Product Name: SITE1

> Canonical product spec. Day-to-day build tracking lives in
> `SCS_BuildHub_FieldTestFeedback_Alpha01.md`. Codebase state in
> `SCS_BuildHub_CurrentState.md`.


---

# 1. PRODUCT VISION
SITE1 is a construction operating system for residential builders, supervisors, trades and clients — a single source of truth for every project. Combines Project Management, Site Operations, Daily Logs, Attendance, Safety, Variations, Communication, Scheduling, Labour Tracking and Commercial Management into one platform.

Philosophy: **One Site. One Platform. One Source of Truth.**

# 2. DESIGN PRINCIPLES
Mobile first · Simple · Fast · Visual · Construction focused. Usable by builders, supervisors, carpenters, apprentices, subcontractors, clients and admin staff without formal training.

# 3. USER TYPES
- **Builder** — company management: oversight, risk, commercial control, scheduling, reporting.
- **Supervisor** — daily site management: labour, progress, daily logs, safety, issues, variations.
- **Worker** — site execution: attendance, tasks, photos, safety, communication.
- **Subcontractor** — trade access: attendance, SWMS, documents, compliance, communication.
- **Client** — project visibility: progress, photos, schedule, approve variations.
- **Office Administration** — documents, variations, invoicing, client comms, scheduling support.

# 4. APPLICATION HIERARCHY
`TODAY → PROJECT → SITE OPERATIONS → COMMERCIAL → ADMINISTRATION`
The project is the central object; all records link back to a project.

# 5. BUILDER DASHBOARD
Executive overview: date, active projects, projects requiring approval, at risk, attention required. **Cards must be clickable.**
Project health summary per project: Job Number, Address, Contact, Current Stage, Cost Spent, Health Score.
Health: Green (healthy) / Amber (attention) / Red (at risk).
Tile behaviour: Active → Projects List · Approvals → Approvals Dashboard · At Risk → Red Projects · Attention → Amber Projects.

# 6. PROJECTS MODULE
Projects must be clickable → open a Project Dashboard. (Current issue: projects display but cannot be opened.)

# 7. PROJECT DASHBOARD
Each project becomes its own workspace. Contains:
Overview · Plans · Tasks · Attendance · Daily Logs · Photos · Safety · Issues · Variations · Commercial · Communication.

# 8. SUPERVISOR DASHBOARD
Run projects. Displays current project + Workers Onsite / Tasks Due / Issues / Hazards — **scoped to the currently selected project only.**
Current Project Indicator: Project Name · ON SITE · live timer (green); OFF SITE (red) when signed out.
Session persistence: reopen on last viewed project.

# 9. ATTENDANCE MODULE
Site attendance register. Types: Employees, Supervisors, Subcontractors, Visitors, Deliveries.
Record: Name, Company, Trade, Phone, Sign In, Sign Out, Total Hours.
Dashboard tabs: Today / History (calendar, date selection, attendance history, visitor records).
Supplier auto-complete: Company field searches existing subcontractors + suppliers.
Sign-out workflow: User → Sign Out → Confirm → Review Time → Save.

# 10. TASK MODULE
Create requires: Title, Assigned To, Priority, Due Date, Due Time, Description, Attachments (Photos, Files, PDFs, Drawings).
Categories: My Tasks / Project Tasks / Team Tasks.
Status: Overdue / Today / Upcoming / Completed.

# 11. DAILY LOG MODULE
Project diary. Create for Today or Choose Date (today + past; **not future**).
Contents: Weather, Workers Onsite, Visitors, Deliveries, Work Completed, Issues, Delays, Materials, Photos.
Smart Yes/No: Deliveries? / Visitors? / Delays? / Issues? — YES → details, NO → "No X recorded".
Attendance validation before submit: show attendance summary; supervisor confirms workers/visitors/subs.
History filters: Day / Week / Month / Custom Range.
Editing after submission: requires Reason For Edit; stores original + revised version, edited by, timestamp, reason.

# 12. ISSUES MODULE
Categories: Safety, Design, Delivery, Inspection, Client, Labour, Subcontractor, Scope Of Work, Other.
Priorities: Critical / High / Medium / Low.
Attachments: Photos, PDFs, Files, Links.
Status: Open / Escalated / Resolved.
Timestamping: Raised By, Date, Time, Project, Category.
Linked tasks: issue may generate a task; bidirectional link.

# 13. SAFETY INTEGRATION
Safety issue auto-creates a Hazard Record.
Hazard categories (multi-select): Trips/Slips, Falls, Equipment, Manual Handling, Dust, Electrical, Public Safety, Vehicle Movement, Other.
Issue cannot close until linked hazard addressed.

# 14. ISSUE RESOLUTION WORKFLOW
Issue → Hazard → Action → Verification → Resolution → Archived Record.
Resolved records retain: original issue, attachments, hazard links, resolution notes, timestamps.

# 15. COMMERCIAL MODULE
All financial/contractual records. Categories: Contracts, Purchase Orders, Quotes, Invoices, Receipts, Variations, Cost Tracking.
Contract status: Draft / Pending Approval / Revision Required / Approved.

# 16. VARIATIONS MODULE
Records: Scope, Cost, Photos, Attachments, Raised By, Date, Timestamp.
Client approval: Digital Approval, Approval Date, Approval User.
Audit trail: original version, revisions, approval history.

# 17. TEAM MODULE
Sections: Employees, Subcontractors, Suppliers.
Member record: contact, role, licences, qualifications, certificates, emergency contact.
Historical reporting: projects worked on, dates attended, hours worked, site history.

# 18. PROJECT HEALTH SCORE
Inputs: overdue tasks, open issues, open hazards, labour overruns, outstanding variations, delayed deliveries, delayed inspections, outstanding decisions, outstanding invoices. Status: Green / Amber / Red.

# 19. BLOCKERS DASHBOARD
Identify constraints: waiting on engineering, client approval, inspection not booked, material delay, trade unavailable. Key management tool.

# 20. FUTURE MODULES
Xero, Client Portal, Geofencing, QR Attendance, Scheduling Engine, Resource Allocation, Cost Codes, Labour Budget Tracking, Productivity Analytics, Estimating Feedback Loop, AI Project Health Forecasting.

# SUCCESS MEASUREMENT
Daily use by site staff · daily logs completed · attendance recorded · variations captured before work proceeds · safety records maintained · issues visible early · project health instant · clients get visibility without internal access.

---

# IMPLEMENTATION STATUS — as of 2026-06-03
Legend: ✅ done · 🟡 partial · ⬜ not started

| PRD § | Area | Status | Notes |
|---|---|---|---|
| 5 | Builder dashboard + clickable tiles | 🟡 | Tiles clickable & filter Projects (H1 ✅). Approvals tile → Labour; no dedicated approvals dashboard yet. |
| 6–7 | **Project Dashboard** | ✅ | Shared by Builder (drill-in from project list) and Supervisor (home). All 11 tiles live: Overview, Project Docs (plans/permits/specs w/ current-superseded), Tasks, Attendance, Daily Logs, Photos (gallery + camera), Safety, Issues, Variations, Commercial, Comms. No placeholders remaining. |
| 8 | Supervisor dashboard | ✅ | Project-scoped metrics ✅, current-project indicator + timer ✅ (H6), session persistence ✅ (H5). |
| 9 | Attendance (currently "On Site") | 🟡 | Sign-in (manual + sub self sign-in) ✅, sign-out + time calc ✅ (C3). Missing: Today/History tabs + calendar (H10), supplier autocomplete (H8), self sign-out sync (H9). Rename On Site → Attendance pending. |
| 10 | Tasks | 🟡 | Create/assign/priority/status/comments/reassign ✅ (C1 fixed). Missing: due **time** + attachments (H11). Categories renamed ✅ (L1). |
| 11 | Daily Log | 🟡 | Basic submit + history ✅. Missing: choose-date, smart Yes/No (H13), attendance validation (H14), filters/search (H15), weather API (M3), editing w/ audit trail. |
| 12 | Issues | 🟡 | 3-tier + priority + escalate + comments + safety auto-link ✅. Missing: expanded categories (9), attachments, issue→task generation, Escalated status. |
| 13–14 | Safety integration | 🟡 | Issue→hazard auto-create ✅. Missing: expanded multi-select hazard categories, resolution/verification workflow + archive. |
| 15 | Commercial module | ✅ | Per-project Commercial: Contracts, Purchase Orders, Quotes, Invoices, Receipts (unified commercial_items), Variations, Cost Tracking rollup. Status flow Draft/Pending/Revision/Approved. File attachments (PDF/photo/receipt) to Supabase Storage. |
| — | **File uploads + AI extraction** | ✅ | Attach PDFs/receipts/photos to commercial records & variations (Supabase Storage `attachments` bucket). "✨ Auto-fill from document" reads receipts/invoices via Claude (extract-receipt Edge Function) and pre-fills vendor/amount/date/ref for human review. |
| 16 | Variations legal record | 🟡 | Approve/reject persist; raise with attachment ✅. Missing: client digital signature + full audit trail (C4). |
| 17 | Team module | 🟡 | Builder Team tab assigns roles ✅. Missing: Employees/Subs/Suppliers split (H3), member detail + history pages (H4). |
| 18 | Project Health Score | 🟡 | Stored on project + shown Green/Amber/Red. Not yet auto-calculated from inputs. |
| 19 | Blockers Dashboard | ⬜ | Not started. |
| 20 | Future modules | ⬜ | Deferred by design. |
