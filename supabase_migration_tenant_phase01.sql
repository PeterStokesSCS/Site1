-- SITE1 multi-tenant — Phase 0–1 (ADDITIVE, REVERSIBLE).
-- Existing tables' RLS is unchanged (only an org_id column is added). The NEW tenant
-- tables get RLS + explicit policies here — they must never be API-exposed unguarded.

-- Phase 0: organisations + org_members + helpers.
create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abn text,
  status text default 'active',
  plan text default 'standard',
  created_at timestamptz default now()
);
create table if not exists org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  role text not null,
  created_at timestamptz default now(),
  unique (org_id, user_id)
);
create index if not exists idx_org_members_user on org_members(user_id);

-- Stable, SECURITY DEFINER helpers (bypass RLS → safe to call from policies; no recursion).
create or replace function auth_org_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select org_id from org_members where user_id = auth.uid()
$$;
create or replace function is_org_admin(p_org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members
                 where org_id = p_org and user_id = auth.uid() and role in ('builder','office'))
$$;

-- RLS on the new tenant tables.
alter table organisations enable row level security;
drop policy if exists "organisations_read" on organisations;
drop policy if exists "organisations_admin_write" on organisations;
create policy "organisations_read" on organisations for select to authenticated
  using (id in (select auth_org_ids()));
create policy "organisations_admin_write" on organisations for all to authenticated
  using (is_org_admin(id)) with check (is_org_admin(id));

alter table org_members enable row level security;
drop policy if exists "org_members_read_own" on org_members;
drop policy if exists "org_members_admin_write" on org_members;
create policy "org_members_read_own" on org_members for select to authenticated
  using (user_id = auth.uid());                                   -- see your own memberships
create policy "org_members_admin_write" on org_members for all to authenticated
  using (is_org_admin(org_id)) with check (is_org_admin(org_id)); -- admins manage + see their org's roster

-- Phase 1: add org_id everywhere, backfill existing data as one org, index it.
do $$
declare t text; org uuid;
begin
  insert into organisations (name) select 'Stokes Construction Services'
    where not exists (select 1 from organisations);
  select id into org from organisations order by created_at limit 1;

  insert into org_members (org_id, user_id, role)
    select org, p.id, coalesce(p.role, 'worker') from profiles p
    on conflict (org_id, user_id) do nothing;

  foreach t in array array[
    'projects','project_members','tasks','hazards','issues','timesheets','daily_logs',
    'variations','purchase_orders','commercial_items','milestones','forecast_changes',
    'procurement_items','qa_items','defects','subbie_requests','project_photos','documents',
    'messages','po_messages','task_comments','issue_comments','variation_labour','blockers',
    'eot_claims','material_requests','notification_log','site_visits','labour_rates'
  ] loop
    execute format('alter table %I add column if not exists org_id uuid references organisations', t);
    execute format('update %I set org_id = %L where org_id is null', t, org);
    execute format('create index if not exists %I on %I (org_id)', 'idx_' || t || '_org', t);
  end loop;
end $$;
