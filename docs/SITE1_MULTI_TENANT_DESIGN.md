# SITE1 — Multi-Tenant Model Design Proposal

**Status:** PROPOSAL for review — **no schema changes made.** Nothing ships until the open decisions (§11) are settled.
**Author:** principal-architect pass per `SITE1_ARCHITECT_MANDATE.md`.
**Why now:** the mandate flags multi-tenant isolation as *not yet established* and a prerequisite. SITE1 is single-tenant today (scoping is per-project-membership; every builder/office user can read every project at the DB level). This document defines the tenant model, the RLS re-keying, and a phased, reversible migration — and fixes the Action-Queue full-table-scan problem along the way.

---

## 1. Goal & the isolation decision

**Goal:** a hard tenant boundary above projects so that one builder company's data is invisible and inaccessible to another, enforced in the database (RLS), at a scale of 1,000+ users / thousands of projects / many independent builder companies.

**Decision 0 — isolation model: shared schema + `org_id` column + RLS (recommended).**

| Option | Verdict |
|---|---|
| **Shared schema, `org_id` + RLS** (one DB, every row tagged, policies key on org) | ✅ **Recommended** — lowest cost per tenant, fits Supabase/Postgres + the existing RLS investment, scales to many small builders, and the C# backend can enforce the same key. |
| Schema-per-tenant | ❌ Operationally heavy at 100s–1000s of small tenants; migrations × N schemas. |
| Database-per-tenant | ❌ Strong isolation but far too costly for many small builders; reserve only for an enterprise tier later. |

The rest of this doc designs the shared-schema model. The discipline that makes it safe: **every tenant row carries `org_id`, and every policy is tenant-first.**

---

## 2. Core entities (new)

### `organisations` — the tenant
```
organisations (
  id            uuid pk default gen_random_uuid(),
  name          text not null,          -- "Stokes Construction Services"
  abn           text,
  status        text default 'active',  -- active | suspended (SaaS billing/lifecycle later)
  plan          text default 'standard',
  created_at    timestamptz default now()
)
```

### `org_members` — who belongs to which tenant, and as what
```
org_members (
  id         uuid pk default gen_random_uuid(),
  org_id     uuid not null references organisations on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  role       text not null,             -- builder | office | supervisor | worker | subcontractor | client
  created_at timestamptz default now(),
  unique (org_id, user_id)
)
```

**This table is the heart of the model.** A user's tenants = the orgs they're a member of. It also moves **role** to be **per-org** (see §5). It is **many-to-many on purpose** — see §8 (a subbie/client can belong to more than one builder org). Internal staff have exactly one membership.

---

## 3. `org_id` on every tenant table (denormalised)

Every tenant-scoped row gets an `org_id uuid not null references organisations`. We **denormalise** it onto each table (rather than join through `project_id → projects.org_id` in every policy) — this is the standard pattern for RLS performance and matches the mandate's "every table carries a tenant id." `org_id` is set on insert (derived from the project, or the creating user's current org).

**Rollout grouping of the current 30 tables:**

| Group | Tables | `org_id` source on insert |
|---|---|---|
| **Tenant root** (new) | `organisations`, `org_members` | n/a |
| **Project-scoped** (most rows) | `projects`, `project_members`, `tasks`, `hazards`, `issues`, `timesheets`, `daily_logs`, `variations`, `purchase_orders`, `commercial_items`, `milestones`, `forecast_changes`, `procurement_items`, `qa_items`, `defects`, `subbie_requests`, `project_photos`, `documents`, `messages`, `po_messages`, `task_comments`, `issue_comments`, `variation_labour`, `blockers`, `eot_claims`, `material_requests`, `notification_log`, `site_visits` | `projects.org_id` (projects.org_id set when the project is created, from the builder's current org) |
| **Org-scoped, user-keyed** | `labour_rates` (a worker's **cost rate is per employer/org** — must be org-scoped), `profile_credentials` (decision: keep on the global profile, or per-org? — see §11) | current org |
| **Global identity** | `profiles` (one row per auth user; **no `org_id`**) — visibility scoped *via* `org_members` (§7) | n/a |

> Note: `po_messages` / `task_comments` / `issue_comments` currently have **open `SELECT` (`using(true)`)** and `notification_log` is fully open — these get `org_id` + a real tenant policy in this work, closing existing debt.

---

## 4. The tenant-first RLS pattern

A small **stable helper** avoids repeating (and re-planning) the membership subquery in every policy:

```sql
create or replace function auth_org_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select org_id from org_members where user_id = auth.uid()
$$;
```

**Canonical project-table policy** (tenant-first, then project-membership OR org-admin):
```sql
create policy "<t>_read" on <t> for select to authenticated using (
  org_id in (select auth_org_ids())                                  -- TENANT GATE (first)
  and (
    project_id in (select project_id from project_members where user_id = auth.uid())
    or exists (select 1 from org_members m
               where m.org_id = <t>.org_id and m.user_id = auth.uid()
                 and m.role in ('builder','office'))                 -- admin, scoped to THIS org
  )
);
-- writes: same predicate in using + with check; with check also pins org_id in (auth_org_ids())
```

Key change in behaviour: **builder/office admin is now scoped to their own org**, not global. `getProjects()` returning *all* projects (today's behaviour) becomes "all projects in my org(s)."

**Owner-keyed tables** (subbie/client) keep their ownership clause *inside* the tenant gate, e.g. `purchase_orders`:
```sql
org_id in (select auth_org_ids())
and (subbie_id = auth.uid()
     or project_id in (select project_id from project_members where user_id = auth.uid())
     or exists (select 1 from org_members m where m.org_id = purchase_orders.org_id and m.user_id = auth.uid() and m.role in ('builder','office')))
```

**Confidential tables** stay isolated *and* tenant-gated: `labour_rates` → `org_id in (auth_org_ids()) and exists(... role in ('builder','office'))`. (Same pattern extends to the deferred financial-column isolation, RLS Stage 3.)

---

## 5. Role becomes per-org

Today `profiles.role` is a single global role. Under tenancy, **authorization role lives on `org_members.role`** (a user could be a worker for one org and, in principle, something else for another; more importantly, role must be evaluated *within* the org being accessed). `profiles.role` is kept during transition as a legacy/default and is no longer the authorization source.

---

## 6. `profiles` visibility under tenancy

`profiles` is currently world-readable (`using(true)`) — under tenancy you must not see users from other orgs. New policy: you can read a profile only if you **share an org** with that user.
```sql
create policy "profiles_read_shared_org" on profiles for select to authenticated using (
  id = auth.uid()
  or exists (select 1 from org_members a join org_members b on a.org_id = b.org_id
             where a.user_id = auth.uid() and b.user_id = profiles.id)
);
```

---

## 7. Subbies & clients across tenants (the crux — Decision A)

The one genuinely hard question. A **subcontractor** (e.g. a plumber) may work for several builder companies; a **client** belongs to one builder (their build). Two ways to model identity:

- **Recommended: one login, many memberships.** A single auth user has one `org_members` row per builder they work with. RLS naturally returns rows across all their orgs (`org_id in (auth_org_ids())`). A subbie sees POs/requests from every org that engaged them; a client has exactly one membership. *Pro:* one identity, no duplicate accounts, future-proof. *Con:* the app needs a "current org / all orgs" context for multi-org users.
- Alternative: one login per builder relationship (a subbie has separate accounts per builder). Simpler RLS, worse UX, duplicate identities. Not recommended.

This choice shapes the session model (§9) and is **Decision A** in §11.

---

## 8. Migration plan — additive, reversible, backfills existing data as Org #1

No destructive step; every phase is independently shippable with a rollback. Existing data is treated as a single tenant so nothing breaks mid-migration.

- **Phase 0 — tenant tables.** Create `organisations` + `org_members` (+ `auth_org_ids()`). Backfill: insert one org ("Stokes Construction Services"); insert an `org_members` row for every existing profile using its current `profiles.role`. *Rollback:* drop the two tables/function.
- **Phase 1 — add `org_id` (nullable) everywhere + indexes.** Add `org_id` to every table in §3; backfill = the single org id (or derive via `project_id`). Add indexes: `org_id` on each table, composites `(org_id, project_id)`, `(org_id, status)`, `(org_id, work_date)` on hot tables, and `org_members(user_id, org_id)`, `project_members(user_id, project_id)`. *Rollback:* drop columns/indexes.
- **Phase 2 — enforce + app writes.** App layer starts setting `org_id` on every insert (via `db.js`); once backfill is verified, set `org_id NOT NULL`. *Rollback:* relax NOT NULL.
- **Phase 3 — re-key RLS tenant-first (the careful one).** Add the new tenant-first policies **alongside** the existing ones; validate with **non-admin authenticated tests** (per the mandate — not just the admin path); then drop the old policies. Keep `_rollback.sql` per the existing RLS-stage convention. This is where "builder sees all projects" becomes "builder sees their org's projects."
- **Phase 4 — app org-context + scoped/limited reads.** Session resolves the user's org(s); `getProjects()` → org-scoped + paginated; Action Queue predicates scoped + limited (§10).

---

## 9. App-layer impact

- **Session / org context.** On login, resolve `org_members` for the user. Single-org users (all internal staff, clients) auto-select their org. Multi-org users (subbies) get a current-org switcher or an aggregated view (Decision A). Authorization role = `org_members.role` for the active org.
- **`db.js`.** Every insert sets `org_id` from the active org (or the parent project's org). List functions filter by org and **add `.limit()`** — no more unbounded `getProjects()` / `getAll*()`. This also pulls the few direct `supabase.from(...)` calls in components (`OnSiteFeature`, `SubcontractorApp` sign-in/out) back through `db.js`.
- **Dev mode / DevSwitcher.** Becomes org-aware (pick org + role).

---

## 10. Scalability — fix the Action Queue at the same time

The derived-never-stored Action Queue currently scans **all rows of a type** (`labour.approve_day` = all pending timesheets; `client_visibility.pending` = all requested photos/defects; `variation.signoff_overdue` = all sent variations; `milestone.forecast_slip` = all milestones), limited only by RLS. Once `org_id` + tenant policies land, RLS scopes these to the caller's org — but we must also:
- add **explicit `.limit()`** and active-only filters to each predicate query;
- ensure the **indexes** in Phase 1 cover each predicate's filter (`(org_id, status)`, `(org_id, work_date)`, `(org_id, visibility_status)`);
- keep the **derived/never-stored** invariant and the **deep-link-to-record** contract intact.

This turns O(all rows) into O(this-org's-active-rows, capped) — the difference between working at 3 projects and 3,000.

---

## 11. Open decisions (need your input before Phase 0)

| # | Decision | Recommendation |
|---|---|---|
| **A** | Can one login (subbie/client) belong to **multiple** builder orgs? | **Yes** — `org_members` many-to-many (§7). Shapes the session model. |
| **B** | Role per-org (`org_members.role`) vs global (`profiles.role`)? | **Per-org** (§5). |
| **C** | Isolation model? | **Shared schema + `org_id` + RLS** (§1). |
| **D** | Are `labour_rates` (and other cost data) **per-org**? | **Yes** — a worker's cost rate belongs to the employing org. |
| **E** | `profile_credentials` (licences/certs) — global to the person, or per-org? | **Global to the person**, readable by orgs sharing the user (a licence is the person's, not a builder's). |
| **F** | How are orgs created — invite-only vs self-signup? | Out of scope for the schema; flag for the SaaS onboarding workstream. |

---

## 12. Audit & backend contract (carried in this work)

- Add **approver/approved-at** to client-visibility approval and an **append-only** audit entry for labour approval (currently only `approved_by` is stamped) — per the auditability lens.
- **`org_id` is the stable tenant key** on every entity. Define it now as part of the data contract shared with the **C# backend** so both Supabase RLS and the C# service enforce the same boundary.

---

## 13. Recommended sequencing after approval

1. Settle §11 decisions (esp. A).
2. Phase 0–1 (additive, invisible to users) — tenant tables, `org_id`, indexes, backfill Org #1.
3. Phase 2–3 (RLS re-key, with non-admin tests + rollback scripts) — the real isolation boundary.
4. Phase 4 (app org-context + scoped/limited reads + Action-Queue scoping).
5. Then the other two SaaS gates: **private bucket + signed URLs**, and **server-side enforcement** of the UI-only authorization paths (client-visibility, financial columns).

**Nothing in §8 runs until you approve §11.**
