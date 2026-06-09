-- SITE1 RLS Stage 3b — role-gate the remaining financial tables (commercial_items,
-- eot_claims, procurement_items). Empirically these leaked to field staff AND clients via the
-- dev-era using(true) policies. Gate to builder/office + the project's supervisor only (these
-- are internal cost records — no field staff, no client, no subbie). Run "without RLS".
-- Phase 3 restrictive tenant gate still ANDs on top. Rollback restores prior open access.

-- Drop the wide-open dev policies (names vary) and any prior role policies.
drop policy if exists "commercial_items_all"    on commercial_items;
drop policy if exists "commercial_items_read"   on commercial_items;
drop policy if exists "commercial_items_write"  on commercial_items;
drop policy if exists "eot_all"                 on eot_claims;
drop policy if exists "eot_claims_read"         on eot_claims;
drop policy if exists "eot_claims_write"        on eot_claims;
drop policy if exists "procurement_all"         on procurement_items;
drop policy if exists "procurement_items_read"  on procurement_items;
drop policy if exists "procurement_items_write" on procurement_items;

-- commercial_items
create policy "commercial_items_read" on commercial_items for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
  or (project_id in (select project_id from project_members where user_id = auth.uid())
      and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor')));
create policy "commercial_items_write" on commercial_items for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
    or (project_id in (select project_id from project_members where user_id = auth.uid())
        and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
    or (project_id in (select project_id from project_members where user_id = auth.uid())
        and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor')));

-- eot_claims
create policy "eot_claims_read" on eot_claims for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
  or (project_id in (select project_id from project_members where user_id = auth.uid())
      and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor')));
create policy "eot_claims_write" on eot_claims for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
    or (project_id in (select project_id from project_members where user_id = auth.uid())
        and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
    or (project_id in (select project_id from project_members where user_id = auth.uid())
        and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor')));

-- procurement_items
create policy "procurement_items_read" on procurement_items for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
  or (project_id in (select project_id from project_members where user_id = auth.uid())
      and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor')));
create policy "procurement_items_write" on procurement_items for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
    or (project_id in (select project_id from project_members where user_id = auth.uid())
        and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
    or (project_id in (select project_id from project_members where user_id = auth.uid())
        and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor')));
