# SITE1 — Sandbox, Multi-Tenant Isolation & Security Validation Report

**Status:** living document. The *Findings* and *Architecture* sections are complete (from a
full code/SQL inspection on 2026-06-09). The *Results* tables are filled in by the automated
suites in `tests/sandbox/`, `tests/e2e/`, and `tests/load/` as they are run.

**Audience:** principal architect / rollout gatekeeper. The single question this document
answers: **can 5+ building companies share SITE1 with zero data leakage between them?**
Today the answer is **NO — do not roll out to real tenants yet.** This document explains
exactly why, and defines the suite that flips the answer to YES.

---

## 1. Architecture as inspected (2026-06-09)

| Area | Current state |
|---|---|
| Frontend | Vite 8, React 19, single SPA (`src/App.jsx`), role-routed views |
| Backend | Supabase (Postgres + PostgREST + Auth + Storage). No custom server. |
| Data layer | `src/lib/db.js` — 99 exported functions, thin wrappers over PostgREST. **All authorization is delegated to Postgres RLS.** There is no app-server trust boundary. |
| Auth | Supabase Auth (email/password). `?dev=true` role preview cannot escalate a non-admin (`App.jsx:73-74`). |
| Roles | `builder` (owner), `office` (admin), `supervisor`, `worker` (carpenter/field), `client`, `subbie` (subcontractor). |
| Tenancy model | `organisations` + `org_members` (many-to-many) + `org_id` column on ~29 tables. Helpers `auth_org_ids()`, `is_org_admin(org_id)` (SECURITY DEFINER). Backfilled to one org. |
| Storage | One **public** bucket `attachments`; `getPublicUrl`; object paths `folder/<ts>-<rand>.<ext>` — **no org segment** (`src/lib/storage.js`). |
| Audit | **None.** Only `notification_log` exists. |
| Tests | Playwright (`tests/*.spec.js`, 2 specs) + Vitest (67 unit). No sandbox/seed/isolation/load/security suites. |

### Tenancy migration progress
- **Phase 0-1 (applied):** `organisations`, `org_members`, helpers, `org_id` columns, backfill, RLS on the two new tables.
- **Phase 2 (applied):** `BEFORE INSERT` triggers that fill `org_id` from the parent project/user.
- **Phase 3 (PILOT, applied):** tenant-first RLS on **`tasks` only**.
- **Phase 4 (NOT started):** app-side org context/session, scoped reads, Action Queue scoping.

---

## 2. Risk register (confirmed by inspection)

Severity: 🔴 Critical (blocks rollout) · 🟠 High · 🟡 Medium.

| # | Risk | Evidence | Severity | Fix |
|---|---|---|---|---|
| R1 | **Cross-org data leakage at DB layer.** ~28 tables still use global-role RLS (`role in ('builder','office')`), no `org_id` gate. Org B's builder can read/write Org A's rows. | `supabase_rls_stage4.sql` (22 global gates), `stage4b.sql` (37). Only `tasks` is tenant-scoped. | 🔴 | **Migration ready:** `supabase_migration_tenant_phase03_rollout.sql` adds a RESTRICTIVE org-gate to all 29 org_id tables (28 read+write, notification_log read-only). Apply, then re-run `sandbox:test`. |
| R2 | **Public file bucket — total file leakage.** Any photo/attachment URL is world-readable, no auth, no org check. Paths are semi-guessable (`<ts>-<6 rand>`). | `src/lib/storage.js:12` `getPublicUrl`; `BUCKET="attachments"` public. | 🔴→🟠 | **App-side DONE:** uploads now write org-prefixed paths, DB stores the path, rendering uses signed URLs (`SignedImage`/`SignedLink`), legacy URLs pass through. **Remaining to fully close:** (1) migrate existing objects under an `<org_id>/` prefix; (2) apply `supabase_migration_storage_private.sql` to flip the bucket private. |
| R3 | **No audit log.** No record of logins, permission-denials, CRUD, role/visibility/variation/PO events. Cannot detect or prove unauthorised access. | Only `notification_log` exists. | 🔴→🟠 | **App-side DONE:** `logAudit()` wired in `db.js` (create task/hazard/log/variation, variation_sent/signed, visibility_approved, po_issued, role_changed, assignment_changed, deletes) + login/login_failed/logout. **Remaining:** apply `supabase_migration_audit_log.sql` to activate; add `permission_denied` + `user_disabled` capture. |
| R4 | **No app-side org context.** Frontend never resolves the user's org; reads aren't org-scoped client-side — they lean entirely on (currently global) RLS. | `App.jsx:39` only `getSession()`. | 🟠 | Phase 4: resolve `org_members` on login, scope reads, scope Action Queue. |
| R5 | **Client-visibility enforced in UI only.** `approveClientVisibility` has no server/RLS gate; a crafted request could flip visibility or read unapproved records. | Prior review note; no RLS predicate on the visibility column. | 🟠 | Column-level RLS so client/subbie roles only select `client_visible = true AND approved`. |
| R6 | **Confidential financial columns not isolated.** Labour rates pattern exists, but commercial/cost columns broadly readable within org regardless of role. | `labour_rates` isolated; others not. | 🟡 | Stage-3 financial-column RLS (supervisor/field cannot read cost). |
| R7 | **Admin-only validation to date.** All green tests so far ran as the builder/admin account — proves the admin branch, not isolation or non-admin RLS. | Project history. | 🟠 | This suite (non-admin + multi-org matrix). |

---

## 3. Test system design

The suite is layered so each layer has a single job and can gate rollout independently.

```
tests/
  sandbox/        # seed/reset + API-level isolation & RBAC matrix (Vitest, live Supabase)
    sandbox.config.js     # 5 orgs × 20 users × roles × projects × entities (scalable)
    lib/clients.mjs       # service-role (seed) + per-user anon (RLS-enforced) clients
    lib/manifest.mjs      # seed writes record-id manifest; tests read it
    seed.mjs / reset.mjs
    isolation.test.mjs    # cross-org read/write/delete/search/notification matrix
    rbac.test.mjs         # role-based access within an org (client/subbie leak checks)
  e2e/            # Playwright role-workflow journeys (Phase B)
  load/           # k6 100/250/500/1000 VU scenarios (Phase B)
  security/       # direct-URL/ID tampering + OWASP ZAP baseline (Phase B)
```

### Why API-level isolation tests first
`db.js` has no server trust boundary — **PostgREST + RLS *is* the API.** So an authenticated
Supabase client signed in as a real seeded user, querying by another org's record id, is an
exact reproduction of the attack surface. These tests need no running frontend and give the
fastest, most direct proof (or disproof) of isolation. They are the rollout gate.

### Safety rails (respecting project constraints)
- **No secrets in repo.** All scripts read `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` from the environment (`.env.test`, git-ignored). The
  service-role key is entered only in the terminal, never in chat/code/git.
- **No real identities.** Seeded users are `&lt;role&gt;&lt;n&gt;@org&lt;k&gt;.sandbox.test` with synthetic
  company/project names. No real client/subbie data (per standing constraint).
- **Sandbox is fenced.** Every seeded row is tagged (org name prefix `SANDBOX —`); `reset.mjs`
  deletes only those orgs and their auth users. It refuses to touch non-sandbox data.
- **CI-safe.** Isolation/RBAC suites auto-skip when env + manifest are absent, so
  `npm run test:unit` stays green without secrets.

---

## 4. Requirement coverage map

| # | Requirement | Layer | Status |
|---|---|---|---|
| 1 | Seed + reset sandbox data | `tests/sandbox/seed.mjs` / `reset.mjs` | **Built** |
| 4 | Multi-tenant isolation tests | `isolation.test.mjs` | **Built** |
| 5 | Role-based access tests | `rbac.test.mjs` | **Built** |
| 9 | Notification leakage | `isolation.test.mjs` (notification_log matrix) | **Built** |
| 7 | Direct URL/ID manipulation | covered by id-tampering cases in isolation suite | **Built (API)** |
| 8 | Search leakage | `isolation.test.mjs` (cross-org search by name) | **Built** |
| 10 | Audit-log tests | `audit.test.mjs` + `logAudit` wired in `db.js`/auth | **Built** (apply `audit_log` migration to activate) |
| 6 | File/photo access tests | needs storage hardening (migration provided) | Infra ready |
| 2 | Playwright E2E role journeys | `tests/e2e/` | Phase B |
| 11 | k6 load (100/250/500/1000) | `tests/load/` | Phase B |
| 3 | API permission tests (E2E via UI) | overlaps isolation + e2e | Partly built |
| 12 | OWASP ZAP baseline | `tests/security/` | Phase B (documented) |
| 13 | CI/test commands | `package.json` scripts | **Built** |

---

## 5. Results (filled by running the suites)

### 5.1 Multi-tenant isolation — `npm run sandbox:test`
> Expected today: PASS for `tasks`, FAIL for the ~28 still-global tables. The FAIL list is the
> Phase-3-rollout checklist.

_(pending first run)_

### 5.2 Role-based access — same command
_(pending first run)_

### 5.3 Load — `npm run load:*`
_(Phase B)_

### 5.4 Highest-risk issues (carry-over from §2 until retested)
1. **R2 public bucket** — fix before *any* real photo is uploaded by a real tenant.
2. **R1 global RLS** — complete Phase 3 rollout before a *second* org logs in.
3. **R3 no audit** — required for breach detection and for client/PO/variation non-repudiation.

---

## 6. Recommendations before production rollout (ordered)

1. Apply `supabase_migration_audit_log.sql` and wire audit writes (login, denied, CRUD, visibility, variation send/sign, PO issue, role/assignment change, disable).
2. ~~Refactor `storage.js` to org-prefixed paths + signed URLs~~ **(done)**. Remaining: migrate existing objects under `<org_id>/`, then apply `supabase_migration_storage_private.sql` to flip the bucket private (legacy public URLs break at that point, so migrate first).
3. Complete **Phase 3** — apply `supabase_migration_tenant_phase03_rollout.sql` (RESTRICTIVE org gate on all 29 org_id tables; AND-s with existing policies, so same-org access is preserved). Re-run `sandbox:test` until isolation is 100% green with a 2nd org. Note: `notification_log` also carries `org_id` (added in Phase 1) and is read-gated; its write path still needs an org_id-setting trigger when the email job is built.
4. Build **Phase 4** app org-context + scoped reads + Action Queue scoping.
5. Add server-side enforcement of client-visibility (R5) and financial-column RLS (R6).
6. Run Playwright role journeys + k6 load + a ZAP baseline; attach results here.
7. Only then: onboard a real second tenant.
