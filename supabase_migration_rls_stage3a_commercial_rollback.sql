-- Rollback Stage 3a — restores the prior project-membership reads/writes on the two
-- commercial tables (the redundant dev-era using(true) policies are intentionally NOT
-- restored — they were the leak). Run "without RLS".
drop policy if exists "purchase_orders_read"  on purchase_orders;
drop policy if exists "purchase_orders_write" on purchase_orders;
create policy "purchase_orders_read" on purchase_orders for select to authenticated using (
  subbie_id = auth.uid()
  or project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "purchase_orders_write" on purchase_orders for all to authenticated
  using (subbie_id = auth.uid()
         or project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (subbie_id = auth.uid()
         or project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

drop policy if exists "variations_read"  on variations;
drop policy if exists "variations_write" on variations;
create policy "variations_read" on variations for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "variations_write" on variations for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
