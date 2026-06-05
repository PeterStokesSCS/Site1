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

## 8. The variation + subcontractor workflow (the largest module)
The Commercial → Variations area is a full contract-variation system. Read `SITE1_BUILD_INVENTORY.md` §9 for detail. In short:
- Builder raises a variation (line items, per-line cost mode, 10% GST, EOT, internal cost/margin), previews it as a **formatted letterhead document**, **Approves for Issue** (locks), then **Sends to client**.
- Client gets a **dashboard alert**, reviews the formatted document, and **signs** (typed signature + timestamp + device/IP capture). A **signed PDF** is generated (`jsPDF`+`html2canvas`, lazy-loaded) and stored.
- **Revisions** (Rev A/B supersede), a merged **audit trail**, and **notification events** are all built.
- **Subcontractor portal:** subbies submit any-format variation requests → builder reviews in a queue → **converts to a draft** (AI-assisted, see §10) or rejects → on client approval the builder **issues a PO** → subbie views/accepts the PO and messages the builder per-PO (builder replies from Commercial → **Subbie POs**).
- Asset: `src/assets/letterhead.png` (the Stokes letterhead) is injected into variation/PO documents.

## 9. External setup needed to fully activate features
These are **deployment/config steps, not code gaps** — the code is built and degrades gracefully without them:

- **AI Edge Functions** (Deno, in `supabase/functions/`). Deploy from the project root:
  ```
  supabase functions deploy extract-receipt   --project-ref fergdbrnwmzxyazqqkkx   # receipt OCR
  supabase functions deploy convert-variation  --project-ref fergdbrnwmzxyazqqkkx   # subbie request -> variation fields
  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # one key, shared by both
  ```
  Until deployed: receipt reading is unavailable, and subbie-request conversion falls back to a note-only prefill (no auto-extract).
- **Automations / notifications** — the app fires fire-and-forget webhook events (`/variations/issued`, `/variations/approved|rejected`, `/variations/notify-supervisor`, `/po/issued`, `/subbie/variation-request`, `/messages`, etc.). They are **no-ops until `VITE_WEBHOOK_BASE`** points at an n8n (or similar) endpoint. Set it in `.env` and build the flows there; no app code change needed.

## 10. Important known gaps / things to be aware of
- **Security (priority):** Most database tables allow any logged-in user to read/write (RLS policies are `using (true)`). Role restrictions — including the variation financial-visibility rules (margin/cost hidden from supervisor/subbie/client) — are enforced in the **UI only, not the database**. This must be hardened before production. (See `SITE1_BUILD_INVENTORY.md` §0 and §19.)
- **No realtime** — screens reload data manually, not via Supabase Realtime.
- **Reserved tables with no UI yet:** `blockers`, `defects`, `qa_items`, `procurement_items`, `eot_claims`, `profile_credentials`, `material_requests` — for upcoming construction modules.
- **`profiles.project_id`** is referenced by the app shell but does not exist as a column (so `user.projectId` is always undefined). `inviteUser()` in `db.js` is unused and would fail from the client.

## 11. Contact
Owner: Peter Stokes — peter@stokesconstructions.com

That's it — start with the docs in section 2 and you'll have the full picture.
