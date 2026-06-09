# SITE1 load tests (k6)

Drives the real Supabase REST + Auth endpoints as authenticated **sandbox** users, with a
realistic read-heavy field mix, at 100 / 250 / 500 / 1,000 virtual users. Surfaces response
times, error rates, slow endpoints, and auth/DB ceilings on the road to 1,000+ users.

## Prereqs
- `brew install k6`
- A seeded sandbox so the manifest + users exist: `npm run sandbox:reseed`
- Supabase creds in your shell (k6 reads OS env as `__ENV`). Easiest:
  ```bash
  export $(grep -v '^#' tests/.env.test | xargs)   # SUPABASE_URL, SUPABASE_ANON_KEY, SANDBOX_PASSWORD
  ```

## Run
```bash
npm run load:smoke    # 5 VUs ~50s — sanity check first
npm run load:100
npm run load:250
npm run load:500
npm run load:1000
```
Each writes `tests/load/<profile>-summary.json` (git-ignored) and prints requests / failed %
/ p95 / max. Thresholds: <5% errors, p95 < 1.5s (reads < 1.2s, writes < 2s) — k6 exits
non-zero if breached, so it doubles as a CI gate.

## Safety
- Point this ONLY at a sandbox project. Writes create `LOAD …`-tagged tasks/logs under
  sandbox projects; clean them with `npm run sandbox:reset` afterwards.
- 500/1000 VUs will stress (and may bill/rate-limit) your Supabase project — that's the
  point, but run them deliberately, not on a shared/prod instance.

## What it simulates
~85% reads (dashboard/projects, open project → tasks, daily logs, hazards, search) and ~15%
writes (create task, submit daily log), with 0.5–2.5s think time per iteration — matching how
field users actually hit the app.
