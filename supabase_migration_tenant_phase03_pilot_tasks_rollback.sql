-- Rollback the tasks pilot — restores the pre-tenant (Stage 2/4) tasks policies.
drop policy if exists "tasks_read" on tasks;
drop policy if exists "tasks_write" on tasks;

create policy "tasks_read" on tasks for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);

create policy "tasks_write" on tasks for all to authenticated
  using (
    project_id in (select project_id from project_members where user_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
  )
  with check (
    project_id in (select project_id from project_members where user_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
  );
