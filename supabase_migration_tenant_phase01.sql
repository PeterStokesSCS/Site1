-- SITE1 multi-tenant — Phase 0–1 (ADDITIVE, REVERSIBLE). No RLS change here.
-- Phase 0: organisations + org_members + auth_org_ids() helper.
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

create or replace function auth_org_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select org_id from org_members where user_id = auth.uid()
$$;

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
