-- ================================================================
-- SITE1 — Migration: Commercial Module (§15)
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

create table if not exists commercial_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  type text check (type in ('contract','purchase_order','quote','invoice','receipt')) not null,
  ref text,
  title text not null,
  description text,
  vendor text,
  amount numeric,
  status text check (status in ('draft','pending','revision','approved')) default 'draft',
  file_url text,
  created_by uuid references profiles,
  created_at timestamptz default now()
);

alter table commercial_items enable row level security;

create policy "commercial_items_read"  on commercial_items for select to authenticated using (true);
create policy "commercial_items_write" on commercial_items for all    to authenticated using (true);
