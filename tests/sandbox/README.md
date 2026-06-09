# SITE1 sandbox — multi-tenant isolation & RBAC harness

Proves (or disproves) that multiple building companies can share SITE1 with **zero**
cross-org data leakage. See `docs/SITE1_SANDBOX_SECURITY_REPORT.md` for the full plan,
risk register, and results.

## What it does
- **`seed.mjs`** — creates `SANDBOX_ORGS` (default 5) organisations, 20 users each across
  every role, projects, and one of every entity (tasks, daily logs, hazards, variations,
  POs, notifications). `org_id` is set explicitly on every row. All data is synthetic and
  tagged `SANDBOX — `. Writes `.manifest.json` (git-ignored) of the ids it created.
- **`isolation.test.mjs`** — signs in as real seeded users (anon key ⇒ **RLS enforced**)
  and attempts every cross-org path: list leakage, read-by-id, update, delete, search,
  notifications. Org A must reach none of org B.
- **`rbac.test.mjs`** — within one org: client and field staff must not read internal/
  commercial records; a subcontractor sees only their own POs.
- **`reset.mjs`** — deletes only sandbox-tagged data (by `SANDBOX — ` org name and
  `*.sandbox.test` emails), in dependency order. Refuses to touch anything else.

## Setup (once)
```bash
cp tests/.env.test.example tests/.env.test
# edit tests/.env.test — paste SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# (service-role key goes ONLY in this git-ignored file, never in chat/commits)
```

## Run
```bash
npm run sandbox:reseed   # reset + seed a clean sandbox
npm run sandbox:test     # isolation + RBAC matrix
npm run sandbox:reset    # tear the sandbox down
```
Quick smoke run: `SANDBOX_ORGS=2 npm run sandbox:reseed`.

## Reading results
- The suite **auto-skips** if env or manifest are missing (so `npm run test:unit` stays
  green in CI without secrets).
- **Today, expect failures.** Only `tasks` has tenant-first RLS (Phase 3 pilot); the other
  tables still use global-role RLS, so org A *will* see org B's rows. Each failing test
  names the leaking table — that list is the Phase-3 rollout checklist. The suite goes
  fully green only when tenancy is complete.

## Safety
- Service-role client (`adminClient`) bypasses RLS and is used **only** by seed/reset.
- Tests use per-user anon clients, so they exercise exactly what a real user could do.
- Never point `.env.test` at a database with real tenant data — this seeds and deletes.
