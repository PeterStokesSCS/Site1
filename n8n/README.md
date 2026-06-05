# SITE1 — n8n Notification Workflows

Starter automations for SITE1's outbound webhook events. SITE1 fires fire-and-forget POSTs to `${VITE_WEBHOOK_BASE}${path}`; n8n receives them and you decide what happens (email, Slack, Telegram, SMS, Xero, etc.).

## Files
- `SITE1_notifications_starter.json` — importable workflow with webhook triggers for the 5 highest-value events, each parsing the payload and wired to a labelled placeholder action.

## Setup (one time)
1. **Import** `SITE1_notifications_starter.json` into n8n (Workflows → ⋯ → Import from File).
2. Point SITE1 at n8n: set the Vercel env var **`VITE_WEBHOOK_BASE`** = `https://YOUR-N8N-HOST/webhook` (no trailing slash, **not** Sensitive), then redeploy SITE1 with a fresh build.
   - n8n's webhook URL is `https://host/webhook/<path>`, and SITE1's event paths already start with `/` (e.g. `/variations/issued`), so they line up: `VITE_WEBHOOK_BASE` + `/variations/issued`.
3. **Activate** the workflow (toggle, top-right). Webhook URLs only go live when the workflow is active. *(While building, use the "Test URL" + "Listen for test event".)*
4. **No CORS configuration needed** — SITE1 sends CORS-safelisted (`text/plain`) requests, so n8n receives them without any allowed-origins setup.

## Replace the placeholders
Each grey `→ …` node is a `NoOp` placeholder. Swap it for a real node and map fields from the preceding **Parse payload** node, e.g. `{{ $json.client_email }}`, `{{ $json.ref }}`, `{{ $json.title }}`.

## Event payloads (fields available after Parse payload)

| Event path | Fired when | Key fields |
|---|---|---|
| `/variations/issued` | Builder sends a variation to the client | `variation_id`, `ref`, `project_id`, `project`, `client_name`, `client_email`, `title`, `total_inc_gst` |
| `/variations/approved` | Client signs/approves | `variation_id`, `ref`, `project_id`, `title`, `total_inc_gst`, `signed_by`, `at` |
| `/variations/rejected` | Client declines | `variation_id`, `ref`, `project_id`, `title`, `total_inc_gst`, `signed_by`, `at`, `reason` |
| `/variations/notify-supervisor` | Builder manually notifies supervisor (scope + EOT only, no $) | `variation_id`, `ref`, `project_id`, `title`, `scope`, `eot`, `eot_days`, `eot_description` |
| `/po/issued` | Builder issues a subbie PO | `po_number`, `project_id`, `variation_id`, `subbie_id`, `po_value`, `scope` |
| `/subbie/variation-request` | Subbie submits a request | `project_id`, `submitted_by`, `trade`, `note`, `file_url`, `project`, `subbie` |
| `/messages` | Chat message sent | `id`, `project_id`, `sender_id`, `channel`, `content`, `image_url` |
| `/variations/status` | Office sets variation status | `id`, `status` |
| `/issues/escalate` | Issue priority escalated | `id`, `priority` |
| `/timeclock/in`, `/timeclock/out` | Clock in/out **(offline retry only)** | `workerId`, `projectId`, `timestamp` |
| `/hazards`, `/site/signin` | Hazard / sign-in **(offline retry only)** | the record payload |

> IDs (`project_id`, `subbie_id`, etc.) are Supabase UUIDs. To turn them into names/emails inside n8n, add a **Supabase** (or HTTP) node that looks the id up in `profiles` / `projects`. Or extend the SITE1 payloads to include the names you need (a small change in `src/lib/webhook.js` callers).

## Suggested first automations
- **`/variations/issued`** → email the client a "New variation to approve" with a link to the portal.
- **`/po/issued`** → email/SMS the subbie their PO details.
- **`/variations/approved`** → notify admin "ready to invoice / add to progress claim" (and later, the Xero hook).
- **`/subbie/variation-request`** → ping the builder that a new request is waiting in the queue.

## Note on delivery reliability
These events fire **from the browser**, so they only send while someone is using the app, and a determined user could spoof them. For guaranteed, tamper-proof delivery, move to **server-side webhooks** later (Supabase Database Webhooks / triggers → n8n) — no browser dependency. Not required to start; the browser approach is fine for notifications.
