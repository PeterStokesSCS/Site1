-- ================================================================
-- SITE1 — RLS Stage 2 ROLLBACK: restore wide-open reads (read = true)
-- ================================================================
-- Run this if Stage 2 scoping causes any access problems. Instantly returns
-- daily_logs / documents / hazards / issues / messages / project_photos /
-- variations read access to the previous permissive state.
-- ================================================================

drop policy if exists "daily_logs_read" on daily_logs;
create policy "daily_logs_read" on daily_logs for select to authenticated using (true);

drop policy if exists "documents_read" on documents;
create policy "documents_read" on documents for select to authenticated using (true);

drop policy if exists "hazards_read" on hazards;
create policy "hazards_read" on hazards for select to authenticated using (true);

drop policy if exists "issues_read" on issues;
create policy "issues_read" on issues for select to authenticated using (true);

drop policy if exists "messages_read" on messages;
create policy "messages_read" on messages for select to authenticated using (true);

drop policy if exists "project_photos_read" on project_photos;
create policy "project_photos_read" on project_photos for select to authenticated using (true);

drop policy if exists "variations_read" on variations;
create policy "variations_read" on variations for select to authenticated using (true);

notify pgrst, 'reload schema';
