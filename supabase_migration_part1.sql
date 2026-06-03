-- ================================================================
-- SCS BuildHub — Migration: Part 1 Feature Spec
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- Add GPS + geofence to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geofence_radius int default 100;

-- Add GPS consent to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gps_consent boolean default false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gps_consent_at timestamptz;

-- Expand priority to 4 levels (add critical)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('critical','high','medium','low'));

ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_priority_check;
ALTER TABLE issues ADD CONSTRAINT issues_priority_check
  CHECK (priority IN ('critical','high','medium','low'));

-- Add safety link between issues and hazards
ALTER TABLE hazards ADD COLUMN IF NOT EXISTS issue_id uuid references issues;
ALTER TABLE issues  ADD COLUMN IF NOT EXISTS hazard_id uuid references hazards;
ALTER TABLE issues  ADD COLUMN IF NOT EXISTS is_safety boolean default false;

-- Task comments
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks on delete cascade,
  author_id uuid references profiles,
  content text not null,
  created_at timestamptz default now()
);

-- Issue comments
CREATE TABLE IF NOT EXISTS issue_comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references issues on delete cascade,
  author_id uuid references profiles,
  content text not null,
  created_at timestamptz default now()
);

-- Site visits (subs, visitors, QR sign-ins)
CREATE TABLE IF NOT EXISTS site_visits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  visitor_name text not null,
  company text,
  trade text,
  phone text,
  reason text,
  type text check (type in ('subcontractor','visitor','delivery')) default 'visitor',
  sign_in timestamptz default now(),
  sign_out timestamptz,
  gps_lat numeric,
  gps_lng numeric,
  swms_acknowledged boolean default false,
  safety_rules_acknowledged boolean default false,
  recorded_by uuid references profiles,
  created_at timestamptz default now()
);

-- RLS on new tables
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_comments_all" ON task_comments FOR ALL TO authenticated USING (true);
CREATE POLICY "issue_comments_all" ON issue_comments FOR ALL TO authenticated USING (true);
CREATE POLICY "site_visits_all" ON site_visits FOR ALL TO authenticated USING (true);
