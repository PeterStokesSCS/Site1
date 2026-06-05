-- ================================================================
-- SITE1 — RLS Hardening Stage 4a: scope WRITES to project members
-- ================================================================
-- Replaces the wide-open ALL-using(true) write policies on the main project
-- data tables with: non-admins may insert/update/delete only rows whose
-- project_id is a project they are a member of; builders/office keep full access.
--
-- USING governs which existing rows can be updated/deleted.
-- WITH CHECK governs the project_id of inserted/updated rows (no cross-project writes).
-- READS are unchanged (Stage 2 already handled them). profiles unchanged.
-- Fully reversible: run supabase_rls_stage4_rollback.sql to restore write = true.
--
-- NOTE: after this, a non-admin must be a PROJECT MEMBER to write to a project
-- (assign them in Builder → Team → Projects). Admins (builder/office) bypass.
-- ================================================================

-- tasks
drop policy if exists "tasks_write" on tasks;
create policy "tasks_write" on tasks for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- timesheets  (members incl. supervisors can write — needed for approvals)
drop policy if exists "timesheets_write" on timesheets;
create policy "timesheets_write" on timesheets for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- daily_logs
drop policy if exists "daily_logs_write" on daily_logs;
create policy "daily_logs_write" on daily_logs for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- documents
drop policy if exists "documents_write" on documents;
create policy "documents_write" on documents for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- hazards
drop policy if exists "hazards_write" on hazards;
create policy "hazards_write" on hazards for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- issues
drop policy if exists "issues_write" on issues;
create policy "issues_write" on issues for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- messages
drop policy if exists "messages_write" on messages;
create policy "messages_write" on messages for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- project_photos
drop policy if exists "project_photos_write" on project_photos;
create policy "project_photos_write" on project_photos for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- variations  (client signs variations on their own project — client is a member)
drop policy if exists "variations_write" on variations;
create policy "variations_write" on variations for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- milestones
drop policy if exists "milestones_write" on milestones;
create policy "milestones_write" on milestones for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- material_requests
drop policy if exists "material_requests_write" on material_requests;
create policy "material_requests_write" on material_requests for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

notify pgrst, 'reload schema';
