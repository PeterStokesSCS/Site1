# SITE1 — Data Dictionary

**Generated:** 2026-06-05
**Scope:** Every table and column in the SITE1 Supabase (PostgreSQL) database, its type, and who writes it.
**Companion:** `SITE1_BUILD_INVENTORY.md` (feature inventory).
**Source of truth for schema:** `supabase_schema.sql` (base), `supabase_migration_part1.sql`, `supabase_migration_photos.sql`, `supabase_migration_commercial.sql`, and `supabase_schema_ensure.sql` (idempotent reconciliation — run this to guarantee the DB matches the code).

**Legend — "Written by":**
- Role names = the in-app role whose UI writes the field (via `src/lib/db.js`).
- `system` = set by a DB default, trigger, or computed in code (not user-entered).
- `unused` = column exists in the DB but **no frontend code writes it** (reserved/legacy).
- All `id` columns are `uuid primary key default gen_random_uuid()` unless noted; all `created_at` are `timestamptz default now()` set by `system`.

**⚠️ RLS note:** Unless stated, every table's policy is `for all to authenticated using (true)` — any authenticated user can write. The "Written by" column reflects which UI *intends* to write it, **not** a database-enforced restriction.

---

## 1. `profiles` — user accounts (extends auth.users)
RLS: read all; update/insert own row only.

| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK, FK auth.users) | system | = auth user id |
| full_name | text | system / builder | set from signup metadata via `handle_new_user()` trigger |
| role | text (enum: builder, supervisor, worker, subcontractor, client, office) | builder | via Team tab `updateProfile` |
| phone | text | unused | column present, no write UI |
| company | text | unused | |
| avatar_url | text | unused | |
| created_at | timestamptz | system | |
| **gps_consent** | boolean (default false) | unused | ensure-script |
| **gps_consent_at** | timestamptz | unused | |
| **address** | text | unused | |
| **emergency_contact_name** | text | unused | |
| **emergency_contact_phone** | text | unused | |
| **emergency_contact_relationship** | text | unused | |

---

## 2. `projects` — the central record
RLS: builders/office read all; others read member projects. Insert builders/office; update builder/office/supervisor.

| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| job_number | text unique not null | builder | |
| street | text not null | builder | |
| suburb | text | builder | |
| client_name | text | builder | |
| client_email | text | builder | |
| client_phone | text | builder | |
| status | text (enum: planning, active, completed, on_hold; default planning) | builder | |
| phase | text | builder | free text |
| progress | int (default 0) | builder | manual |
| budget | numeric | builder | = original contract value |
| spent | numeric (default 0) | unused | never written by any feature |
| start_date | date | builder | |
| end_date | date | builder | |
| health | text (enum: green, amber, red; default green) | builder | manual |
| telegram_chat_id | text | unused | reserved for Telegram |
| created_at | timestamptz | system | |
| **lat** | numeric | system | auto-geocoded on create (Nominatim) |
| **lng** | numeric | system | auto-geocoded on create |
| **geofence_radius** | int (default 100) | unused | not enforced on clock-in |

---

## 3. `project_members` — project ↔ user assignment
RLS: read all; write builders/office. **No UI assigns members** (gap).

| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | unused | no assignment UI |
| user_id | uuid (FK profiles, cascade) | unused | |
| role | text | unused | |
| created_at | timestamptz | system | |
| | | | unique(project_id, user_id) |

---

## 4. `milestones` — project progress stages
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | unused | read-only in app |
| name | text not null | unused | |
| sort_order | int (default 0) | unused | |
| done | boolean (default false) | unused | |
| completed_date | date | unused | |
| created_at | timestamptz | system | |

> Read by client progress view (`getMilestones`); **no create/edit UI**.

---

## 5. `tasks`
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | supervisor | |
| title | text not null | supervisor | |
| assignee_id | uuid (FK profiles) | supervisor | nullable |
| due_date | date | supervisor | |
| status | text (enum: todo, in_progress, completed, blocked; default todo) | supervisor / worker | worker toggles completed |
| priority | text (default medium) | supervisor | base check low/medium/high **dropped** to allow `critical` |
| created_by | uuid (FK profiles) | supervisor | |
| created_at | timestamptz | system | |
| **description** | text | supervisor | ensure-script |
| **due_time** | time | supervisor | |
| **attachments** | text[] | unused | column present; photos use `project_photos` instead |

---

## 6. `task_comments`
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| task_id | uuid (FK tasks, cascade) | supervisor | |
| author_id | uuid (FK profiles) | supervisor | |
| content | text not null | supervisor | |
| created_at | timestamptz | system | |

---

## 7. `hazards`
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | worker / supervisor | |
| title | text not null | worker / supervisor | doubles as description |
| risk | text (enum: low, medium, high) not null | worker / supervisor | |
| category | text | worker / supervisor | from HAZARD_CATEGORIES (frontend list) |
| control_measures | text | supervisor | empty from worker flow |
| status | text (enum: open, resolved; default open) | system / supervisor | resolve sets resolved |
| reported_by | uuid (FK profiles) | worker / supervisor | |
| photo_url | text | unused | photos now via `project_photos` |
| created_at | timestamptz | system | |
| resolved_at | timestamptz | system | set on resolve |
| **issue_id** | uuid (FK issues) | supervisor | ensure-script; bidirectional link from Issues |

---

## 8. `timesheets`
RLS: worker reads own; builder/office/supervisor read all.

| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | worker | set on clock-in |
| worker_id | uuid (FK profiles) | worker | |
| work_date | date not null | system | local date on clock-in |
| clock_in | timestamptz | worker | |
| clock_out | timestamptz | worker | |
| hours_worked | numeric | system | computed (out−in)/3600000, 2dp |
| task_description | text | unused | never captured |
| status | text (enum: pending, approved, rejected; default pending) | builder/office/supervisor | approve only; rejected unused |
| approved_by | uuid (FK profiles) | builder/office/supervisor | |
| created_at | timestamptz | system | |

---

## 9. `site_visits` — visitor/sub/delivery muster
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | supervisor / subcontractor | |
| visitor_name | text not null | supervisor / subcontractor | |
| company | text | supervisor | |
| trade | text | supervisor / subcontractor | |
| phone | text | supervisor | |
| reason | text | supervisor | |
| type | text (enum: subcontractor, visitor, delivery; default visitor) | supervisor / subcontractor | |
| sign_in | timestamptz (default now) | supervisor / subcontractor | |
| sign_out | timestamptz | supervisor | set on sign-out |
| gps_lat | numeric | unused | column present |
| gps_lng | numeric | unused | |
| swms_acknowledged | boolean (default false) | subcontractor | sign-in checkbox |
| safety_rules_acknowledged | boolean (default false) | subcontractor | sign-in checkbox |
| recorded_by | uuid (FK profiles) | supervisor / subcontractor | |
| created_at | timestamptz | system | |

---

## 10. `daily_logs`
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | supervisor | |
| submitted_by | uuid (FK profiles) | supervisor | |
| log_date | date not null | supervisor | local date |
| weather | text | supervisor | free text |
| workers_on_site | int | supervisor | coerced to int |
| progress_notes | text | supervisor | |
| deliveries | text | supervisor | |
| visitors | text | supervisor | |
| issues | text | supervisor | |
| created_at | timestamptz | system | |

---

## 11. `variations`
Base + Phase-1 sign-off/commercial columns. Two UIs write this (see inventory §9).

| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | builder | |
| ref | text | builder | auto `JOBNUMBER-V01`, set once |
| title | text not null | builder | |
| description | text | builder | scope of works |
| amount | numeric | builder | mirrors total_inc_gst (rollup compat) |
| status | text | builder / client / office | base check pending/approved/rejected/signed; app also uses `draft`, `sent`, `superseded` |
| raised_by | uuid (FK profiles) | builder | |
| approved_by | uuid (FK profiles) | office | |
| created_at | timestamptz | system | |
| **reason** | text | builder | ensure-script |
| **line_items** | jsonb (default []) | builder | `[{id, description, mode, cost, margin_pct, client_amount, gst_exempt}]` |
| **subtotal** | numeric | builder | computed |
| **gst_amount** | numeric | builder | computed (10%) |
| **total_inc_gst** | numeric | builder | computed |
| **builder_cost** | numeric | builder | internal — not client-visible |
| **margin_amount** | numeric | builder | internal — builder/office only |
| **client_total** | numeric | builder | = subtotal (ex GST) |
| **eot** | boolean (default false) | builder | extension of time toggle |
| **eot_days** | int | builder | |
| **eot_description** | text | builder | |
| **instruction_note** | text | builder | client instruction/evidence |
| **attachments** | text[] | builder | file/photo URLs |
| **photos** | text[] | unused | reserved |
| **file_url** | text | builder (legacy) | single attachment (older flow) |
| **audit_trail** | jsonb (default []) | builder | app-appended events (created/edited/sent) |
| **revision_history** | jsonb (default []) | builder / client | app-appended (issued/approved/rejected) |
| **client_approved** | boolean (default false) | client | set on sign |
| **client_signature** | text | client | typed full name (e-signature) |
| **signature_image** | text | unused | reserved for drawn signature |
| **approval_date** | timestamptz | client | sign timestamp |
| **approval_ip** | text | unused | spec wants capture; not implemented |
| **approval_device** | text | unused | spec wants capture; not implemented |
| **approved_version** | text | unused | reserved |
| **approval_statement_accepted** | boolean (default false) | unused | reserved (checkbox) |
| **signed_pdf_url** | text | unused | PDF generation not built |
| **revision_label** | text | unused | Rev A/B not built |
| **supersedes_id** | uuid | unused | revision control reserved |
| **superseded_by_id** | uuid | unused | |
| **contract_total_snapshot** | numeric | unused | reserved for locked total |
| **sent_at** | timestamptz | builder | set on issue-to-client |
| **viewed_by_client_at** | timestamptz | unused | reserved |

---

## 12. `issues`
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | supervisor | |
| title | text not null | supervisor | |
| description | text | supervisor | |
| category | text | supervisor | default "Other" |
| priority | text (default medium) | supervisor | base check low/medium/high **dropped** to allow critical |
| status | text (enum: open, in_progress, resolved; default open) | supervisor | |
| raised_by | uuid (FK profiles) | supervisor | |
| created_at | timestamptz | system | |
| **is_safety** | boolean (default false) | supervisor | ensure-script |
| **hazard_id** | uuid (FK hazards) | supervisor | link to auto-created hazard |

---

## 13. `issue_comments`
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| issue_id | uuid (FK issues, cascade) | supervisor | |
| author_id | uuid (FK profiles) | supervisor | |
| content | text not null | supervisor | |
| created_at | timestamptz | system | |

---

## 14. `messages` — project chat
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | builder/supervisor/office | |
| sender_id | uuid (FK profiles) | any role | |
| channel | text (enum: team, trades, client; default team) | sender | |
| content | text not null | sender | image-only sends null (needs attention) |
| created_at | timestamptz | system | |
| **image_url** | text | sender | ensure-script; inline chat photo |

---

## 15. `documents`
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | builder/supervisor | |
| name | text not null | builder/supervisor | |
| category | text | builder/supervisor | |
| file_url | text | builder/supervisor | |
| version | text | builder/supervisor | free text |
| superseded | boolean (default false) | builder/supervisor | toggle |
| uploaded_by | uuid (FK profiles) | builder/supervisor | |
| created_at | timestamptz | system | |

---

## 16. `commercial_items` — contracts, POs, quotes, invoices, receipts
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | builder | |
| type | text | builder | contract/purchase_order/quote/invoice/receipt |
| ref | text | builder | |
| title | text not null | builder | |
| description | text | builder | |
| vendor | text | builder | |
| amount | numeric | builder | |
| status | text (default draft) | builder | draft/pending/revision/approved/rejected/signed |
| file_url | text | builder | |
| created_by | uuid (FK profiles) | builder | |
| created_at | timestamptz | system | |

> Receipt fields (vendor/amount/gst/date/ref/description) may be pre-filled by the `extract-receipt` Edge Function (AI), then confirmed by the builder.

---

## 17. `project_photos`
| Column | Type | Written by | Notes |
|---|---|---|---|
| id | uuid (PK) | system | |
| project_id | uuid (FK projects, cascade) | any role | |
| url | text not null | any role | Supabase Storage public URL (`attachments` bucket) |
| caption | text | any role | |
| taken_by | uuid (FK profiles) | any role | |
| created_at | timestamptz | system | |
| **category** | text | any role | progress/safety/defect/qa/delivery/general |
| **linked_record_type** | text | any role | task/daily_log/hazard/issue/message/defect/qa_item/procurement/variation/general |
| **linked_record_id** | uuid | any role | the linked record's id |
| **client_visible** | boolean (default false) | builder/supervisor | role-gated toggle |
| **gps_lat** | numeric | system | device GPS at capture |
| **gps_lng** | numeric | system | |
| **gps_accuracy_m** | numeric | system | |
| **gps_on_site** | boolean | system | distance < 500m |
| **gps_distance_from_site_m** | numeric | system | Haversine from project lat/lng |
| **taken_at** | timestamptz (default now) | system | |
| **file_name** | text | system | original filename |
| **file_size_kb** | int | system | compressed size |

---

## 18–23. Phase-2 tables — EXIST IN DB, NO UI / NO db.js (reserved)

These were created by `supabase_schema_ensure.sql` ahead of the construction modules. **Nothing in the frontend reads or writes them yet.** All `id`/`created_at` as standard; RLS `for all using(true)`.

### 18. `blockers`
`project_id` uuid, `title` text not null, `source_module` text, `source_record_id` uuid, `description` text, `assigned_to` uuid→profiles, `due_date` date, `priority` text (default high), `status` text (default open), `action_required` text, `resolution_notes` text, `resolved_at` timestamptz, `created_by` uuid→profiles.

### 19. `defects`
`project_id` uuid, `title` text not null, `location_area` text, `description` text, `defect_type` text, `priority` text (default medium), `status` text (default open), `assigned_to` uuid→profiles, `related_trade` text, `due_date` date, `client_visible` boolean (default false), `completion_notes` text, `raised_by` uuid→profiles, `closed_by` uuid→profiles, `closed_at` timestamptz.

### 20. `qa_items` — quality/inspections
`project_id` uuid, `title` text not null, `stage` text, `hold_point` boolean (default false), `must_pass_before_proceeding` boolean (default false), `inspection_required` boolean (default false), `inspector` text, `assigned_to` uuid→profiles, `due_date` date, `status` text (default not_started), `checklist_items` jsonb (default []), `photos_required` boolean (default false), `notes` text, `rejection_reason` text, `approved_by` uuid→profiles, `approved_at` timestamptz, `created_by` uuid→profiles.

### 21. `procurement_items`
`project_id` uuid, `item_name` text not null, `category` text, `supplier` text, `required_by_date` date, `ordered_date` date, `expected_delivery_date` date, `actual_delivery_date` date, `status` text (default required), `linked_po_id` uuid→commercial_items, `delivery_docket_url` text, `notes` text, `blocking_project` boolean (default false), `blocker_id` uuid→blockers, `created_by` uuid→profiles.

### 22. `eot_claims` — extension of time
`project_id` uuid, `title` text not null, `cause` text, `description` text, `days_claimed` int, `date_of_delay` date, `claim_submitted_date` date, `status` text (default draft), `linked_daily_log_ids` uuid[], `linked_procurement_ids` uuid[], `formal_notice_url` text, `created_by` uuid→profiles.

### 23. `profile_credentials` — licences/tickets
`profile_id` uuid→profiles (cascade), `type` text, `name` text not null, `number` text, `issued_date` date, `expiry_date` date.

---

## 24. `material_requests` — base schema, NO UI (reserved)
`project_id` uuid, `item` text not null, `quantity` numeric, `unit` text, `urgency` text (enum: today, this-week, next-week), `requested_by` uuid→profiles, `status` text (enum: pending, ordered, delivered; default pending), `notes` text.

---

## Storage

| Bucket | Visibility | Contents | Written by |
|---|---|---|---|
| `attachments` | public | photos, document files, variation/commercial attachments | `src/lib/storage.js → uploadFile()` |

Files stored at `${folder}/${timestamp}-${rand}.${ext}`. Folders used: `photos/<projectId>`, `records/<projectId>/<recordType>`, `chat/<projectId>`, `variations/<projectId>`, `documents`, `misc`.

---

## Database functions / triggers

| Object | Purpose |
|---|---|
| `handle_new_user()` + trigger `on_auth_user_created` | Auto-inserts a `profiles` row on `auth.users` insert, copying `full_name` from signup metadata. |

## Edge Functions (Deno, server-side)

| Function | Purpose | Notes |
|---|---|---|
| `extract-receipt` | AI receipt OCR → `{vendor, amount, gst, date, ref, description}` | Requires deploy + `ANTHROPIC_API_KEY` secret in Supabase. Called from `src/lib/ai.js`. |
