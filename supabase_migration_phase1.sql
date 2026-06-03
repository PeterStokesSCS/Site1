-- ================================================================
-- SITE1 — Phase 1.9 Migrations (reconciled with current schema)
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Idempotent: safe to run more than once.
-- ================================================================

-- ── Photos: extend existing project_photos (this IS the photos table) ──────────
alter table project_photos add column if not exists category text;
alter table project_photos add column if not exists linked_record_type text;
alter table project_photos add column if not exists linked_record_id uuid;
alter table project_photos add column if not exists client_visible boolean default false;

-- ── Blockers ───────────────────────────────────────────────────────────────────
create table if not exists blockers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  source_module text,
  source_record_id uuid,
  description text,
  assigned_to uuid references profiles,
  due_date date,
  priority text check (priority in ('critical','high','medium','low')) default 'high',
  status text check (status in ('open','waiting','action_required','resolved','cancelled')) default 'open',
  action_required text,
  resolution_notes text,
  resolved_at timestamptz,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
alter table blockers enable row level security;
create policy "blockers_all" on blockers for all to authenticated using (true);

-- ── Variation extended fields (supports digital sign-off + audit) ──────────────
alter table variations add column if not exists photos text[];
alter table variations add column if not exists attachments text[];
alter table variations add column if not exists client_approved boolean default false;
alter table variations add column if not exists client_signature text;
alter table variations add column if not exists approval_date timestamptz;
alter table variations add column if not exists revision_history jsonb default '[]';

-- ── Task extended fields ───────────────────────────────────────────────────────
alter table tasks add column if not exists due_time time;
alter table tasks add column if not exists description text;
alter table tasks add column if not exists attachments text[];

-- ── Profile extended fields ────────────────────────────────────────────────────
alter table profiles add column if not exists address text;
alter table profiles add column if not exists emergency_contact_name text;
alter table profiles add column if not exists emergency_contact_phone text;
alter table profiles add column if not exists emergency_contact_relationship text;

-- ── Credentials ────────────────────────────────────────────────────────────────
create table if not exists profile_credentials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles on delete cascade,
  type text check (type in ('licence','certificate','qualification','insurance')),
  name text not null,
  number text,
  issued_date date,
  expiry_date date,
  created_at timestamptz default now()
);
alter table profile_credentials enable row level security;
create policy "credentials_all" on profile_credentials for all to authenticated using (true);

-- ── Defects ────────────────────────────────────────────────────────────────────
create table if not exists defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  location_area text,
  description text,
  defect_type text check (defect_type in ('qa','pci','handover','warranty','damage','incomplete','rework')),
  priority text check (priority in ('critical','high','medium','low')) default 'medium',
  status text check (status in ('open','assigned','in_progress','ready_for_review','closed','rejected','warranty')) default 'open',
  assigned_to uuid references profiles,
  related_trade text,
  due_date date,
  client_visible boolean default false,
  completion_notes text,
  raised_by uuid references profiles,
  closed_by uuid references profiles,
  closed_at timestamptz,
  created_at timestamptz default now()
);
alter table defects enable row level security;
create policy "defects_all" on defects for all to authenticated using (true);

-- ── QA / Inspections ───────────────────────────────────────────────────────────
create table if not exists qa_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  stage text,
  hold_point boolean default false,
  must_pass_before_proceeding boolean default false,
  inspection_required boolean default false,
  inspector text,
  assigned_to uuid references profiles,
  due_date date,
  status text check (status in ('not_started','in_progress','ready_for_review','approved','rejected','rework_required')) default 'not_started',
  checklist_items jsonb default '[]',
  photos_required boolean default false,
  notes text,
  rejection_reason text,
  approved_by uuid references profiles,
  approved_at timestamptz,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
alter table qa_items enable row level security;
create policy "qa_all" on qa_items for all to authenticated using (true);

-- ── Procurement (linked_po_id points to commercial_items in our model) ─────────
create table if not exists procurement_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  item_name text not null,
  category text,
  supplier text,
  required_by_date date,
  ordered_date date,
  expected_delivery_date date,
  actual_delivery_date date,
  status text check (status in ('required','selected','quoted','ordered','in_transit','delivered','installed','delayed','cancelled')) default 'required',
  linked_po_id uuid references commercial_items,
  delivery_docket_url text,
  notes text,
  blocking_project boolean default false,
  blocker_id uuid references blockers,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
alter table procurement_items enable row level security;
create policy "procurement_all" on procurement_items for all to authenticated using (true);

-- ── EOT (Extension of Time) ────────────────────────────────────────────────────
create table if not exists eot_claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  cause text check (cause in ('weather','client_delay','supply_chain','authority','variation','other')),
  description text,
  days_claimed int,
  date_of_delay date,
  claim_submitted_date date,
  status text check (status in ('draft','submitted','approved','rejected')) default 'draft',
  linked_daily_log_ids uuid[],
  linked_procurement_ids uuid[],
  formal_notice_url text,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
alter table eot_claims enable row level security;
create policy "eot_all" on eot_claims for all to authenticated using (true);
