# SITE1 — Developer Handoff

Welcome. This is **SITE1**, a construction management web app for Stokes Construction Services. This file tells you everything you need to get running and where to look.

---

## 1. What it is
- **Frontend:** Vite + React 19 single-page app (plain inline styles, no Tailwind).
- **Backend:** Supabase (PostgreSQL database + Auth + Storage + Edge Functions). There is **no separate API server** — the React app talks directly to Supabase.
- **Hosting:** Vercel. **Repo:** GitHub. **Database:** Supabase.

## 2. Read these first (in the repo root)
- **`SITE1_BUILD_INVENTORY.md`** — every feature that's built, what's incomplete, and assumptions made.
- **`SITE1_DATA_DICTIONARY.md`** — every database table and column, its type, and who writes it.
- **`supabase_schema_ensure.sql`** — the complete, idempotent database schema (single source of truth). Run this in Supabase SQL Editor to (re)create or sync the whole database.

## 3. Run it locally
```bash
npm install
cp .env.example .env     # then fill in the values (see step 4)
npm run dev
```
Tests (Playwright): `npm test`

## 4. Environment variables (`.env`)
You'll be sent these privately — never commit them.
```
VITE_SUPABASE_URL=...        # the Supabase project URL
VITE_SUPABASE_ANON_KEY=...   # the Supabase anon/public key
VITE_WEBHOOK_BASE=           # optional, n8n automations; leave blank = no-op
```

## 5. Access you'll be granted separately
- **GitHub** repo (write access).
- **Supabase** project (to see the database/auth/storage), or set up your own and run `supabase_schema_ensure.sql`.
- **Vercel** project (if deploying).

## 6. How the code is laid out
- `src/lib/db.js` — the data layer; every database read/write goes through here.
- `src/lib/supabase.js` — Supabase client.
- `src/App.jsx` — auth + routes the user to one of 6 role apps.
- `src/components/<role>/` — the apps for builder, supervisor, worker, subcontractor, client, office.
- `src/components/shared/` — shared screens (Project Dashboard, Photos, Commercial, Variations, etc.).

## 7. The 6 user roles
`builder`, `supervisor`, `worker`, `subcontractor`, `client`, `office`. Role is stored in `profiles.role`. To preview any role locally without logging in, add `?dev=true&role=supervisor` (etc.) to the URL.

## 8. Important known gaps / things to be aware of
- **Security (priority):** Most database tables currently allow any logged-in user to read/write (Row Level Security policies are `using (true)`). Role restrictions are enforced in the UI only, **not** in the database. This needs hardening before real production use. (Details in `SITE1_BUILD_INVENTORY.md` §0 and §19.)
- **Variations** has two UIs that aren't yet unified (a simple read-only one on the dashboard, and the new full-featured one under Commercial). See inventory §9.
- **No realtime** — screens reload data manually, not via Supabase Realtime.
- **Phase-2 tables** (`blockers`, `defects`, `qa_items`, `procurement_items`, `eot_claims`, `profile_credentials`, `material_requests`) exist in the database but have **no UI yet** — they're reserved for upcoming modules.
- The **AI receipt reader** is a Supabase Edge Function (`extract-receipt`) that needs deploying with an `ANTHROPIC_API_KEY` secret.

## 9. Contact
Owner: Peter Stokes — peter@stokesconstructions.com

That's it — start with the two docs in section 2 and you'll have the full picture.
