-- ================================================================
-- SITE1 — RLS Hardening Stage 2: scope READ access to project members
-- ================================================================
-- Applies the same pattern already live on projects/tasks/timesheets to the
-- currently wide-open tables. Non-admins can only read rows for projects they
-- are a member of; builders/office keep full access (admin bypass).
--
-- WRITES are NOT changed by this script (still open — handled in a later stage).
-- profiles read is NOT changed (names stay readable).
-- Fully reversible: run supabase_rls_stage2_rollback.sql to restore read = true.
-- ================================================================

-- daily_logs
drop policy if exists "daily_logs_read" on daily_logs;
create policy "daily_logs_read" on daily_logs for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);

-- documents
drop policy if exists "documents_read" on documents;
create policy "documents_read" on documents for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);

-- hazards
drop policy if exists "hazards_read" on hazards;
create policy "hazards_read" on hazards for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);

-- issues
drop policy if exists "issues_read" on issues;
create policy "issues_read" on issues for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);

-- messages  (project-scoped; channel-level isolation comes in Stage 3)
drop policy if exists "messages_read" on messages;
create policy "messages_read" on messages for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);

-- project_photos  (project-scoped; client-visible-only filtering comes in Stage 3)
drop policy if exists "project_photos_read" on project_photos;
create policy "project_photos_read" on project_photos for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);

-- variations
drop policy if exists "variations_read" on variations;
create policy "variations_read" on variations for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);

notify pgrst, 'reload schema';
