# SITE1 — Timeline Engine (Phase 2), Step 0 Findings Report

**Generated:** 2026-06-07
**Status:** Findings only — **no feature code written.** Awaiting review before building (per spec §2).

The headline finding up front: **most of the Timeline Engine's high-value rules depend on modules that exist only as empty database tables with no UI and no data.** So this phase splits cleanly into "buildable & valuable now" vs. "built but dormant until its module exists." Details below.

---

## 1. Phase 1 reuse — confirmed ✅
- **Predicate registry** is `src/lib/actionQueue.js` → `REGISTRY` (array of `{ key, role, priority, query(ctx) }`), consumed by `computeActionItems()` + the `useActionItems` hook. Timeline risks slot in as **new registry entries** — no parallel system.
- **Melbourne-time helpers** already exist there (`melbourneTodayStr`, `melbourneHour`, etc.) — reuse for date-only timeline logic.
- **Scoping** is automatic via RLS (supervisor → assigned projects, builder → all, subby/client restricted, no financials to subby) — inherited for free.
- **Nav-intent** deep-links (`target:{kind,projectId,entityId}`) + `KIND_TO_PROJECT_SCREEN` map — extend with new kinds.
- **notification_log** table exists for the (deferred) hourly job.

---

## 2. Module liveness audit (which rules each rule needs)

| Source module | In DB? | UI / data today? | Gates these rules |
|---|---|---|---|
| **tasks** | ✅ | ✅ LIVE (create/list/detail) | `task.overdue` (already Phase 1), `task.material_not_on_site` (also needs procurement) |
| **variations** | ✅ | ✅ LIVE (full epic) | `variation.eot_unapplied` |
| **milestones** | ✅ | ⚠️ **read-only** (client progress reads them; **no create/edit UI**, sparse model) | `milestone.forecast_slip` |
| **attendance** | ✅ | ✅ LIVE — but **actuals only** (clock-ins), **not a forward roster** | (not the labour-allocation rule) |
| **daily_logs** | ✅ | ✅ LIVE | — |
| **procurement_items** | ✅ table | ❌ **0 UI refs — no screen, no data** | `procurement.order_by_breach`, `procurement.delivery_late`, `task.material_not_on_site` |
| **qa_items (inspections)** | ✅ table | ❌ **0 UI refs** | `inspection.due_soon` |
| **defects** | ✅ table | ❌ **0 UI refs** | (no §7 rule directly; defect due-dates feed lookahead) |
| **labour_allocations** | ❌ **no table** | ❌ doesn't exist (net-new concept) | `labour.double_booked` |

**Consequence:** of the 8 risk rules in §7, only **`milestone.forecast_slip`** and **`variation.eot_unapplied`** can produce real items now (plus `task.overdue` from Phase 1). The five marquee rules — including the headline "windows not ordered" (`procurement.order_by_breach`) — are **inert** until Procurement / Inspections / a Labour-allocation roster are actually built and populated. The spec anticipates this ("feature-guarded off until that module exists", §2.2/§10.5) — but it's worth being blunt: **the flagship value of this phase is gated on the Procurement module, which is currently just an empty table.**

---

## 3. Date / relationship / lead-time field audit (§4 + §5)

Most additions are clean and additive. "≈" = an existing column already serves the role under a different name.

| Object | Spec wants | Exists today | To add (additive, nullable) |
|---|---|---|---|
| **tasks** | start_date, due_date, predecessor_task_id, blocks_milestone_id, depends_on_procurement_ids[] | `due_date` ✅, `due_time` ✅ | `start_date`, `predecessor_task_id`, `blocks_milestone_id`, `depends_on_procurement_ids uuid[]` |
| **procurement_items** | required_by_date, lead_time_days, ordered_at?, expected_delivery_date?, delivered_at?, status, linked_task_id?, linked_milestone_id? | `required_by_date` ✅, `ordered_date`(≈ordered_at), `expected_delivery_date` ✅, `actual_delivery_date`(≈delivered_at), `status` ✅, `linked_po_id` ✅ | **`lead_time_days`**, **`linked_task_id`**, **`linked_milestone_id`** |
| **variations** | time_impact_days (EOT), approval status, applied_to_forecast | `eot_days` ✅ (**= time_impact_days**), `eot` ✅, status ✅ | **`applied_to_forecast` bool** |
| **qa_items** | required_date, completed_date?, status, linked_milestone_id? | `due_date`(≈required_date), `approved_at`(≈completed_date), `status` ✅ | `linked_milestone_id` |
| **defects** | due_date, responsible_party, status | `due_date` ✅, `assigned_to`/`related_trade`(≈responsible_party), `status` ✅ | (none required) |
| **labour_allocations** | allocation_date, worker_or_subby_id, project_id | ❌ **table does not exist** | **whole new table** (only if building the labour rule now) |
| **milestones** | key, label, sequence, plannedDate, forecastDate, actualDate?, status(derived) | `name`(≈label), `sort_order`(≈sequence), `completed_date`(≈actualDate), `done` | **`key`**, **`planned_date`**, **`forecast_date`** (status derived, not stored) |
| **(new)** forecast-change audit | what/why/days/who/when | ❌ | **new `forecast_changes` table** |

**§5 relationship/lead-time — can they be added cleanly?** **Yes** — all the link/lead-time fields are plain additive nullable columns; no clean-add blocker, nothing to flag-and-stop on. **But** they're only *useful* once a UI captures them, and the spec rightly says these are captured *inside existing flows* (procurement screen, task creation). Since the **procurement screen doesn't exist**, the links can't be populated yet → the rules that read them stay dormant. So: schema = easy; activation = gated on building the Procurement UI.

---

## 4. What's buildable & valuable NOW vs. built-but-guarded

**Activatable now (real value, no missing module):**
- **Milestone baseline/forecast spine** — extend the `milestones` table, seed the VIC skeleton (`site_start → base → frame → lock_up → fixing → practical_completion`) on project creation, give the builder a setup editor (planned dates / add / remove). *(This is a genuine build — milestones are currently read-only and sparse.)*
- **`variation.eot_unapplied`** + the **"Add N days?" forecast confirm flow** with the audit table — variations are live and already carry `eot_days`. High value, fully buildable.
- **`milestone.forecast_slip`** — once the baseline/forecast model exists.
- **Views:** Builder **Project Timeline** (milestone list: planned/forecast/actual + at-risk section), Supervisor **Lookahead** (Today/Tomorrow/This week/Next week over **tasks** that exist; deliveries/inspections appear once those modules do), Client **Progress** (reuses milestone status + their action items).

**Built but guarded OFF (registry entries that return nothing until their module is live):**
- `procurement.order_by_breach`, `procurement.delivery_late`, `task.material_not_on_site` → need the **Procurement module** (UI + data).
- `inspection.due_soon` → needs the **QA/Inspections module**.
- `labour.double_booked` → needs a **Labour-allocation roster** (net-new table + UI).

Guarding = a `MODULES` flag map (`{ procurement:false, inspections:false, labour:false }`); each guarded rule's query early-returns `[]` when its flag is off. Flip the flag when the module ships (§10.5).

---

## 5. Timezone & dates
- All timeline logic in **`Australia/Melbourne`**, reusing the existing helpers. New date fields (`planned_date`, `forecast_date`, `start_date`, `lead_time` math, `required_by_date`) are **date-only** (`date` type), compared in Melbourne. `must_order_by = required_by_date − lead_time_days` is plain date math.

---

## 6. Migration plan (additive, non-destructive)
1. `milestones`: add `key text`, `planned_date date`, `forecast_date date`. (label≈name, sequence≈sort_order, actual≈completed_date kept.)
2. `tasks`: add `start_date date`, `predecessor_task_id uuid`, `blocks_milestone_id uuid`, `depends_on_procurement_ids uuid[]`.
3. `procurement_items`: add `lead_time_days int`, `linked_task_id uuid`, `linked_milestone_id uuid`.
4. `variations`: add `applied_to_forecast boolean default false`.
5. `qa_items`: add `linked_milestone_id uuid`.
6. New table **`forecast_changes`** (id, project_id, milestone_id, days, reason, confirmed_by, created_at).
7. *(Only if building the labour rule now)* new table **`labour_allocations`** (id, project_id, worker_or_subby_id, allocation_date, created_by, created_at).

All `if not exists`, nullable, in `supabase_schema_ensure.sql`.

---

## 7. Decisions I need before building

1. **Scope of this phase (the big one).** The headline "windows not ordered" value needs the **Procurement module** (currently an empty table). Two paths:
   - **(A, recommended) Ship the timeline spine now, guard procurement/inspection/labour rules off.** Deliver: milestone baseline/forecast + VIC seeding + builder editor, EOT→forecast confirm flow + audit, `milestone.forecast_slip`, and the three read-only views. The dormant rules + all relationship fields are built so the moment Procurement lands they light up. **Value now, no half-built procurement.**
   - **(B) Build the Procurement module as part of this phase** so the flagship rule activates — but that's a substantial extra build (procurement list/detail UI, ordering, delivery tracking, linking to tasks/milestones), effectively a second module bolted on.
2. **Milestones:** extend the existing `milestones` table (recommended — additive, keeps the client progress view working) vs. a new table? *(Recommend extend.)*
3. **Labour double-booking:** build the net-new `labour_allocations` roster now, or defer (rule guarded off)? *(Recommend defer — it's a brand-new data-entry concept the app doesn't have; attendance is actuals, not a forward roster.)*
4. Confirm the **additive migration set** in §6 is acceptable.

---

## 8. Recommended build order (if you pick A)
1. **Data architecture** — milestone columns + VIC seeding on project create + `forecast_changes` table + all relationship/lead-time fields (additive). Migration run once.
2. **Forecast logic** — milestone forecast maintenance + `variation.eot_unapplied` "Add N days?" confirm flow with audit + unit tests.
3. **Timeline Engine** — `milestone.forecast_slip` live; procurement/inspection/labour rules implemented + **guarded off**; all wired into the existing Action Queue registry; unit tests (incl. the §11 graceful-degradation test that emits nothing when lead time is missing).
4. **Views** — Builder Project Timeline + Supervisor Lookahead + Client Progress (simple, read-only, no Gantt).
5. **Activation later** — flip module guards as Procurement / Inspections / Labour modules get built.

Each step ships independently, exactly like Phase 1.

---

**My one-line recommendation:** *Path A — build the timeline spine + EOT-forecast flow + the now-activatable rule and the three views; wire and guard the procurement/inspection/labour rules so they're ready; treat the Procurement module as its own follow-on build that unlocks the flagship "order-by" value.* Say the word and I'll start with the data architecture.
