-- ================================================================
-- SITE1 — Schema Reconciliation (idempotent "ensure" script)
-- Guarantees every table + column the app uses exists.
-- Safe to run repeatedly. Run the WHOLE file in Supabase SQL Editor.
-- ================================================================

-- ── PROJECTS — extended columns ─────────────────────────────────
alter table projects add column if not exists suburb text;
alter table projects add column if not exists client_phone text;
alter table projects add column if not exists start_date date;
alter table projects add column if not exists end_date date;
alter table projects add column if not exists progress int default 0;
alter table projects add column if not exists spent numeric default 0;
alter table projects add column if not exists health text default 'green';
alter table projects add column if not exists telegram_chat_id text;
alter table projects add column if not exists lat numeric;
alter table projects add column if not exists lng numeric;
alter table projects add column if not exists geofence_radius int default 100;
-- Subbies may read the project row (name/address only) for projects where they
-- hold a PO or have submitted a request — WITHOUT full project membership, so they
-- gain no access to financial/operational project data. (Additive; OR'd with projects_read.)
drop policy if exists "projects_read_subbie" on projects;
create policy "projects_read_subbie" on projects for select to authenticated using (
  id in (select project_id from purchase_orders where subbie_id = auth.uid())
  or id in (select project_id from subbie_requests where submitted_by = auth.uid())
);

-- ── PROFILES — extended columns ─────────────────────────────────
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists company text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists gps_consent boolean default false;
alter table profiles add column if not exists gps_consent_at timestamptz;
alter table profiles add column if not exists address text;
alter table profiles add column if not exists emergency_contact_name text;
alter table profiles add column if not exists emergency_contact_phone text;
alter table profiles add column if not exists emergency_contact_relationship text;
-- Builders/office may update any profile (Team-tab role assignment). Self-update stays via profiles_update_own.
drop policy if exists "profiles_admin_update" on profiles;
create policy "profiles_admin_update" on profiles for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('builder','office')));

-- ── TASKS — extended columns + relax priority ───────────────────
alter table tasks add column if not exists description text;
alter table tasks add column if not exists due_time time;
alter table tasks add column if not exists attachments text[];
alter table tasks drop constraint if exists tasks_priority_check;

-- ── ISSUES — safety link + relax priority ───────────────────────
alter table issues add column if not exists is_safety boolean default false;
alter table issues add column if not exists hazard_id uuid references hazards;
alter table issues drop constraint if exists issues_priority_check;

-- ── HAZARDS — issue link ────────────────────────────────────────
alter table hazards add column if not exists issue_id uuid references issues;

-- ── VARIATIONS — attachments + client sign-off ──────────────────
-- Workflow uses draft/approved_for_issue/sent/superseded beyond the base check.
alter table variations drop constraint if exists variations_status_check;
alter table variations add column if not exists ref text;
alter table variations add column if not exists file_url text;
alter table variations add column if not exists photos text[];
alter table variations add column if not exists attachments text[];
alter table variations add column if not exists client_approved boolean default false;
alter table variations add column if not exists client_signature text;
alter table variations add column if not exists approval_date timestamptz;
alter table variations add column if not exists revision_history jsonb default '[]';
-- Variation workflow (Alpha Rev 06): line items, GST, EOT, internal cost/margin,
-- instruction evidence, audit trail, signature metadata, revision control.
alter table variations add column if not exists reason text;
alter table variations add column if not exists line_items jsonb default '[]';
alter table variations add column if not exists subtotal numeric;
alter table variations add column if not exists gst_amount numeric;
alter table variations add column if not exists total_inc_gst numeric;
alter table variations add column if not exists builder_cost numeric;
alter table variations add column if not exists margin_amount numeric;
alter table variations add column if not exists client_total numeric;
alter table variations add column if not exists eot boolean default false;
alter table variations add column if not exists eot_days int;
alter table variations add column if not exists eot_description text;
alter table variations add column if not exists instruction_note text;
alter table variations add column if not exists audit_trail jsonb default '[]';
alter table variations add column if not exists signature_image text;
alter table variations add column if not exists approval_ip text;
alter table variations add column if not exists approval_device text;
alter table variations add column if not exists approved_version text;
alter table variations add column if not exists approval_statement_accepted boolean default false;
alter table variations add column if not exists signed_pdf_url text;
alter table variations add column if not exists revision_label text;
alter table variations add column if not exists supersedes_id uuid;
alter table variations add column if not exists superseded_by_id uuid;
alter table variations add column if not exists contract_total_snapshot numeric;
alter table variations add column if not exists sent_at timestamptz;
alter table variations add column if not exists viewed_by_client_at timestamptz;

-- ── PROJECT_PHOTOS — linking, client flag, GPS, metadata ────────
alter table project_photos add column if not exists category text;
alter table project_photos add column if not exists linked_record_type text;
alter table project_photos add column if not exists linked_record_id uuid;
alter table project_photos add column if not exists client_visible boolean default false;
alter table project_photos add column if not exists gps_lat numeric;
alter table project_photos add column if not exists gps_lng numeric;
alter table project_photos add column if not exists gps_accuracy_m numeric;
alter table project_photos add column if not exists gps_on_site boolean;
alter table project_photos add column if not exists gps_distance_from_site_m numeric;
alter table project_photos add column if not exists taken_at timestamptz default now();
alter table project_photos add column if not exists file_name text;
alter table project_photos add column if not exists file_size_kb int;

-- ── MESSAGES — inline photo ─────────────────────────────────────
alter table messages add column if not exists image_url text;

-- ── DOCUMENTS — version flags ───────────────────────────────────
alter table documents add column if not exists version text;
alter table documents add column if not exists superseded boolean default false;

-- ── SITE_VISITS — full column set ───────────────────────────────
alter table site_visits add column if not exists company text;
alter table site_visits add column if not exists trade text;
alter table site_visits add column if not exists phone text;
alter table site_visits add column if not exists reason text;
alter table site_visits add column if not exists type text;
alter table site_visits add column if not exists sign_out timestamptz;
alter table site_visits add column if not exists gps_lat numeric;
alter table site_visits add column if not exists gps_lng numeric;
alter table site_visits add column if not exists swms_acknowledged boolean default false;
alter table site_visits add column if not exists safety_rules_acknowledged boolean default false;

-- ── COMMERCIAL_ITEMS ────────────────────────────────────────────
create table if not exists commercial_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  type text, ref text, title text not null, description text,
  vendor text, amount numeric, status text default 'draft',
  file_url text, created_by uuid references profiles,
  created_at timestamptz default now()
);
alter table commercial_items enable row level security;
drop policy if exists "commercial_items_all" on commercial_items;
create policy "commercial_items_all" on commercial_items for all to authenticated using (true);

-- ── COMMENTS (task + issue) ─────────────────────────────────────
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks on delete cascade,
  author_id uuid references profiles, content text not null,
  created_at timestamptz default now()
);
alter table task_comments enable row level security;
drop policy if exists "task_comments_all" on task_comments;
create policy "task_comments_all" on task_comments for all to authenticated using (true);

create table if not exists issue_comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references issues on delete cascade,
  author_id uuid references profiles, content text not null,
  created_at timestamptz default now()
);
alter table issue_comments enable row level security;
drop policy if exists "issue_comments_all" on issue_comments;
create policy "issue_comments_all" on issue_comments for all to authenticated using (true);

-- ── BLOCKERS ────────────────────────────────────────────────────
create table if not exists blockers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null, source_module text, source_record_id uuid,
  description text, assigned_to uuid references profiles, due_date date,
  priority text default 'high', status text default 'open',
  action_required text, resolution_notes text, resolved_at timestamptz,
  created_by uuid references profiles, created_at timestamptz default now()
);
alter table blockers enable row level security;
drop policy if exists "blockers_all" on blockers;
create policy "blockers_all" on blockers for all to authenticated using (true);

-- ── DEFECTS ─────────────────────────────────────────────────────
create table if not exists defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null, location_area text, description text,
  defect_type text, priority text default 'medium', status text default 'open',
  assigned_to uuid references profiles, related_trade text, due_date date,
  client_visible boolean default false, completion_notes text,
  raised_by uuid references profiles, closed_by uuid references profiles,
  closed_at timestamptz, created_at timestamptz default now()
);
alter table defects enable row level security;
drop policy if exists "defects_all" on defects;
create policy "defects_all" on defects for all to authenticated using (true);

-- ── QA / INSPECTIONS ────────────────────────────────────────────
create table if not exists qa_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null, stage text, hold_point boolean default false,
  must_pass_before_proceeding boolean default false, inspection_required boolean default false,
  inspector text, assigned_to uuid references profiles, due_date date,
  status text default 'not_started', checklist_items jsonb default '[]',
  photos_required boolean default false, notes text, rejection_reason text,
  approved_by uuid references profiles, approved_at timestamptz,
  created_by uuid references profiles, created_at timestamptz default now()
);
alter table qa_items enable row level security;
drop policy if exists "qa_all" on qa_items;
create policy "qa_all" on qa_items for all to authenticated using (true);

-- ── PROCUREMENT ─────────────────────────────────────────────────
create table if not exists procurement_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  item_name text not null, category text, supplier text,
  required_by_date date, ordered_date date, expected_delivery_date date, actual_delivery_date date,
  status text default 'required', linked_po_id uuid references commercial_items,
  delivery_docket_url text, notes text, blocking_project boolean default false,
  blocker_id uuid references blockers, created_by uuid references profiles,
  created_at timestamptz default now()
);
alter table procurement_items enable row level security;
drop policy if exists "procurement_all" on procurement_items;
create policy "procurement_all" on procurement_items for all to authenticated using (true);

-- ── EOT CLAIMS ──────────────────────────────────────────────────
create table if not exists eot_claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null, cause text, description text,
  days_claimed int, date_of_delay date, claim_submitted_date date,
  status text default 'draft', linked_daily_log_ids uuid[], linked_procurement_ids uuid[],
  formal_notice_url text, created_by uuid references profiles,
  created_at timestamptz default now()
);
alter table eot_claims enable row level security;
drop policy if exists "eot_all" on eot_claims;
create policy "eot_all" on eot_claims for all to authenticated using (true);

-- ── PROFILE CREDENTIALS ─────────────────────────────────────────
create table if not exists profile_credentials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles on delete cascade,
  type text, name text not null, number text,
  issued_date date, expiry_date date, created_at timestamptz default now()
);
alter table profile_credentials enable row level security;
drop policy if exists "credentials_all" on profile_credentials;
create policy "credentials_all" on profile_credentials for all to authenticated using (true);

-- ── SUBBIE VARIATION REQUESTS (AI-assisted intake) ──────────────
create table if not exists subbie_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  submitted_by uuid references profiles,
  trade text, note text, file_url text,
  ai_extracted jsonb, ai_flags text[],
  status text default 'submitted',   -- submitted / converted / approved / rejected
  rejection_reason text,
  linked_variation_id uuid references variations,
  created_at timestamptz default now()
);
alter table subbie_requests enable row level security;
drop policy if exists "subbie_requests_all" on subbie_requests;
create policy "subbie_requests_all" on subbie_requests for all to authenticated using (true);

-- ── PURCHASE ORDERS (issued to subbies on client-approved variations) ──
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  variation_id uuid references variations,
  subbie_id uuid references profiles,
  po_number text, trade text, scope text,
  eot boolean default false, eot_days int, eot_description text,
  po_value numeric, gst_treatment text default '10%',
  status text default 'issued',      -- issued / accepted
  accepted_at timestamptz, signature text,
  created_by uuid references profiles, created_at timestamptz default now()
);
alter table purchase_orders enable row level security;
drop policy if exists "purchase_orders_all" on purchase_orders;
create policy "purchase_orders_all" on purchase_orders for all to authenticated using (true);

-- ── PO MESSAGES (per-PO thread, builder ↔ subbie) ───────────────
create table if not exists po_messages (
  id uuid primary key default gen_random_uuid(),
  po_id uuid references purchase_orders on delete cascade,
  sender_id uuid references profiles,
  content text not null,
  created_at timestamptz default now()
);
alter table po_messages enable row level security;
drop policy if exists "po_messages_all" on po_messages;
create policy "po_messages_all" on po_messages for all to authenticated using (true);

-- ── Refresh the API schema cache ────────────────────────────────
notify pgrst, 'reload schema';
