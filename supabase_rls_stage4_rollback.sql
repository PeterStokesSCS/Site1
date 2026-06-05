-- ================================================================
-- SITE1 — RLS Stage 4a ROLLBACK: restore wide-open writes (write = true)
-- ================================================================
-- Run this if Stage 4a write-scoping blocks any legitimate save. Instantly
-- restores the previous permissive ALL-using(true) write policies.
-- ================================================================

drop policy if exists "tasks_write" on tasks;
create policy "tasks_write" on tasks for all to authenticated using (true);

drop policy if exists "timesheets_write" on timesheets;
create policy "timesheets_write" on timesheets for all to authenticated using (true);

drop policy if exists "daily_logs_write" on daily_logs;
create policy "daily_logs_write" on daily_logs for all to authenticated using (true);

drop policy if exists "documents_write" on documents;
create policy "documents_write" on documents for all to authenticated using (true);

drop policy if exists "hazards_write" on hazards;
create policy "hazards_write" on hazards for all to authenticated using (true);

drop policy if exists "issues_write" on issues;
create policy "issues_write" on issues for all to authenticated using (true);

drop policy if exists "messages_write" on messages;
create policy "messages_write" on messages for all to authenticated using (true);

drop policy if exists "project_photos_write" on project_photos;
create policy "project_photos_write" on project_photos for all to authenticated using (true);

drop policy if exists "variations_write" on variations;
create policy "variations_write" on variations for all to authenticated using (true);

drop policy if exists "milestones_write" on milestones;
create policy "milestones_write" on milestones for all to authenticated using (true);

drop policy if exists "material_requests_write" on material_requests;
create policy "material_requests_write" on material_requests for all to authenticated using (true);

notify pgrst, 'reload schema';
