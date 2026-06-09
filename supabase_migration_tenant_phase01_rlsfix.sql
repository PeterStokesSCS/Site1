-- Catch-up: ensure is_org_admin() exists AND the new tenant tables are RLS-locked.
-- Idempotent — safe whether the original or corrected Phase 0-1 was applied. Run "without RLS".
create or replace function is_org_admin(p_org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members
                 where org_id = p_org and user_id = auth.uid() and role in ('builder','office'))
$$;

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
  using (user_id = auth.uid());
create policy "org_members_admin_write" on org_members for all to authenticated
  using (is_org_admin(org_id)) with check (is_org_admin(org_id));
