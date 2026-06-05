# SITE1 — Action Queue, Step 0 Findings Report

**Generated:** 2026-06-06
**Status:** Findings only — **no feature code written.** Awaiting review before building (per spec §1).

This report answers the four Step-0 items and flags three things that materially change the plan and need your decision.

---

## 1. Stack & conventions

| Concern | Reality in SITE1 |
|---|---|
| Framework | **Vite + React 19** SPA. Plain inline styles (no CSS framework). No TypeScript — **plain JS/JSX** (the spec's TS types are fine as a contract; I'll implement in JS). |
| Backend | **Supabase** only (Postgres + Auth + Storage + Edge Functions). No custom API server. |
| Data/query layer | `src/lib/db.js` — thin functions over `supabase.from(...)`. All reads/writes go through the user's Supabase session. |
| Auth / permissions | Supabase Auth + **Row-Level Security**. Project scoping is now enforced at the DB layer (member-or-admin reads/writes, subby ownership, `projects_read_subbie` for label-only). **Compute-on-read can reuse this for free** — a client-side query runs under the user's session and RLS scopes it automatically. |
| Routing | ⚠️ **No router.** Navigation is **component state** (`BuilderApp` tab state, `ProjectDashboard` `screen` state, `openProject`). There are **no URLs per screen**. See Flag A. |
| Dashboards (surfaces) | Builder: `src/components/builder/BuilderApp.jsx` (DashboardTab). Supervisor + project context: `src/components/shared/ProjectDashboard.jsx`. Client: `src/components/client/ClientApp.jsx`. Subby: `src/components/subcontractor/SubcontractorApp.jsx`. |
| Scheduled jobs | ⚠️ **None exist.** No cron, no server runtime besides Edge Functions. See Flag B. |
| Email | ⚠️ **Not wired.** No email provider. The only outbound path is browser→webhook→n8n (currently pointing at a test inbox, not connected to email). See Flag B. |

---

## 2. State-transition timestamp audit

Good news: **most predicates can derive age/overdue from columns that already exist** — so the required migration footprint is much smaller than the spec assumes. Below, "since" = the column I'd use for `ageHours`.

| Entity | Spec wants | Exists today? | Plan |
|---|---|---|---|
| variations | `sent_at` | ✅ `sent_at` | use as-is (signoff windows) |
| variations | `rejected_at` | ⚠️ no — but `approval_date` is set on **both** approve & reject | use `approval_date` as the decision timestamp; **no new column** |
| variations | `priced_at` | ❌ no | "priced" is derivable as `total_inc_gst > 0`; for age use `created_at`. Optional `priced_at` if you want exact pricing-age (Flag C) |
| purchase_orders | `issued_at`, `accepted_at` | `accepted_at` ✅; `issued_at` ❌ | PO is created at issue → use `created_at` as issued time; **no new column** |
| timesheets | `submitted_at` | ❌ (have `clock_in`, `clock_out`, `created_at`) | use `clock_out` (shift complete = submitted) or `created_at`; **no new column** |
| timesheets (shift) | `clock_in_at`, `clock_out_at` | ✅ `clock_in`, `clock_out` | use as-is (open-shift / too-long) |
| hazards | `opened_at`, `closed_at`, `risk_level` | `created_at` ✅, `resolved_at` ✅, `risk` ✅ | use as-is |
| issues | `opened_at`, `closed_at` | `created_at` ✅; no closed ts | `issue.open` only needs status + `created_at`; **closed ts not required** |
| tasks | `due_at`, `completed_at` | `due_date` + `due_time` (separate); `status` | derive `due_at` from `due_date`+`due_time` (Melbourne); `task.overdue` checks `status != completed` — **`completed_at` not required** |
| daily_logs | `log_date`, `submitted_at` | `log_date` ✅, `created_at` = submit ✅ | use as-is |
| subbie_requests | `decided_at`, `outcome`, `viewed_at` | `status` = outcome ✅; `decided_at` ❌; `viewed_at` ❌ | **ADD `viewed_at` (required)** + **ADD `decided_at` (recommended for accurate age)** |
| receipts (commercial_items type='receipt') | `extracted_at`, `confirmed_at` | neither; has `status`, `created_at` | low-priority type; derive age from `created_at`, "confirmed" from `status`. Optional columns (Flag C) |

### Strictly-required migration (additive, nullable, non-destructive)
1. `alter table subbie_requests add column if not exists viewed_at timestamptz;` — needed for `request.outcome_unviewed`.
2. `alter table subbie_requests add column if not exists decided_at timestamptz;` — recommended; set when builder converts/rejects, for correct item age.
3. **`notification_log`** table (for Phase 4 idempotency):
   ```sql
   create table if not exists notification_log (
     id uuid primary key default gen_random_uuid(),
     type text, entity_type text, entity_id uuid,
     recipient text, sent_at timestamptz default now()
   );
   ```
   (with a unique index on `(type, entity_id)` to enforce single-send).

### Optional (only if you want exact ages, not blocking)
- `variations.priced_at`, `commercial_items.confirmed_at` / `extracted_at`.

**Write-path impact:** the only existing write paths I'd touch are tiny, additive timestamp sets — `decided_at` on convert/reject (in the variations module), `viewed_at` when a subby opens a request. Nothing else changes. This respects spec §10.

---

## 3. Three flags that need your decision before I build

### Flag A — "deepLink" has no routes to link to (architectural)
The `ActionItem.deepLink: string` assumes URL routes. **SITE1 has none** — every screen is reached by setting component state, and the app forgets where you are on refresh. Options:

- **A1 (recommended, in-scope):** Replace `deepLink: string` with a structured **navigation intent**, e.g. `target: { kind: 'variation'|'timesheet'|'hazard'|..., projectId, entityId }`. The "Open" button dispatches it; I add a small intent-handler in each dashboard that opens the right project → screen → record. Keeps everything in-app, no router needed. Adds modest navigation plumbing.
- **A2 (bigger):** Introduce real URL routing (React Router) so deep links are genuine URLs (and survive refresh/email links). Larger change touching all four apps; better long-term, especially for email links that should open a specific screen.

> This matters for Phase 4 too: an **email** "Open" link needs a real URL (A2) to land on the right screen. With A1, an email can only deep-link to the app's front door. **Recommend A1 now, with A2 flagged as the upgrade when email links need to target screens.**

### Flag B — the hourly job + email have no home yet (infrastructure)
Phase 1 §2.2/§6 require an **hourly server job** that runs time-based predicates and **sends email**. Neither exists. To build Phase 4 I need a decision on:
- **Job runner:** Supabase **pg_cron** calling a **scheduled Edge Function** (Deno) — cleanest, stays in Supabase. (Alternative: Vercel Cron + a new serverless route, but the app is currently a pure static SPA.)
- **Email channel:** (a) a provider like **Resend/SendGrid/Postmark/SMTP** called from the Edge Function, or (b) route through **n8n** (which already receives our events) and let n8n send the email. (b) reuses the webhook layer you just wired; (a) is self-contained.
- **Server-side scoping:** the cron job runs with the **service role** and therefore **bypasses RLS** — so the time-based predicates must apply scoping explicitly when resolving recipients (they can't lean on RLS like the in-app path does). I'll write the predicates to be scope-explicit so they're safe in both paths.

> **Phases 1–3 (the in-app Attention Centre) need none of this** — they run client-side under RLS. So I can deliver the visible value first and treat Flag B as a Phase-4 decision.

### Flag C — `variation.priced_at` has no natural event
In the current flow there's no distinct "priced" action — the builder fills line items and the status stays `draft` until "Approve for Issue." So:
- **Recommended:** treat "priced" as a **derived** condition (`total_inc_gst > 0`); use the variation's `created_at` (set at convert) for age. No new column, no write-path change.
- **If you want exact pricing-age:** add `priced_at`, set it the first time line items are saved. Small write-path touch.

Default to the derived approach unless you want the exact timestamp.

---

## 4. Timezone

The spec requires `Australia/Melbourne` for all day boundaries/cutoffs. Today the app uses **browser-local** dates (`localDateStr`), which *happens* to be Melbourne for these users but isn't guaranteed, and the **server job has no browser**. Plan:
- In-app predicates: compute "today"/cutoffs with an explicit Melbourne offset helper (not raw UTC, not blind browser local).
- Server job: compute Melbourne explicitly in the Edge Function.
- (There's prior art here — we already fixed a UTC `work_date` bug by going date-agnostic; I'll keep that lesson.)

---

## 5. Access scope — reuse, don't reimplement
- **In-app (compute-on-read):** queries run under the user's Supabase session → **existing RLS scopes them automatically.** Builder/office see all; supervisor only assigned projects; subby only own POs/requests; client only their project. Nothing to reimplement. ✅
- **Subby payloads:** I'll build subby predicates to select only non-financial fields (po_number, scope, project name) — never margin/cost/contract totals — matching §2.4 and the subby RLS already in place.
- **Server job:** must scope explicitly (service role bypasses RLS) — noted in Flag B.

---

## 6. Recommended build order (adjusted to these findings)

1. **Foundations** — the two `subbie_requests` timestamps + `notification_log`; a JS `ActionItem` shape; a **predicate registry** (`src/lib/actionQueue/…`), each type a scoped query; the **navigation-intent** mechanism (Flag A1); unit-style tests for each predicate's trigger/resolution.
2. **Internal surfaces** — Builder *Action Queue* + Supervisor *My actions today* (top of their dashboards).
3. **External surfaces** — Client *Requires your attention* + Subby *Action required*.
4. **Notifications** — only after you choose the Flag-B options (job runner + email channel). Reusable dispatch interface, hourly Edge Function over time-based predicates, `notification_log` idempotency.

Phases 1–3 ship visible value with **one tiny migration** and **no new infrastructure**. Phase 4 is gated on your Flag-B decision.

---

## 7. Decisions I need from you to proceed

1. **Flag A:** in-app navigation intents now (A1), or invest in real URL routing (A2)? *(Recommend A1 now.)*
2. **Flag B (only blocks Phase 4):** job runner = Supabase cron+Edge Function or Vercel Cron? Email = direct provider (which?) or via n8n?
3. **Flag C:** derive "priced" (no column) or add `priced_at`? *(Recommend derive.)*
4. Confirm the **minimal migration** (just `subbie_requests.viewed_at` + `decided_at` + `notification_log`) is acceptable, rather than adding every timestamp the spec listed.

On your answers, I'll start **Phase 1 (Foundations)** and nothing before it.
