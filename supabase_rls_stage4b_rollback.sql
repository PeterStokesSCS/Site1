-- ================================================================
-- SITE1 — RLS Stage 4b ROLLBACK: restore single permissive FOR ALL policies
-- ================================================================
-- Run this if Stage 4b breaks any legitimate read/write. Restores each table's
-- original `for all using(true)` policy and removes the split read/write ones.
-- ================================================================

drop policy if exists "commercial_items_read" on commercial_items;
drop policy if exists "commercial_items_write" on commercial_items;
create policy "commercial_items_all" on commercial_items for all to authenticated using (true);

drop policy if exists "site_visits_read" on site_visits;
drop policy if exists "site_visits_write" on site_visits;
create policy "site_visits_all" on site_visits for all to authenticated using (true);

drop policy if exists "subbie_requests_read" on subbie_requests;
drop policy if exists "subbie_requests_write" on subbie_requests;
create policy "subbie_requests_all" on subbie_requests for all to authenticated using (true);

drop policy if exists "purchase_orders_read" on purchase_orders;
drop policy if exists "purchase_orders_write" on purchase_orders;
create policy "purchase_orders_all" on purchase_orders for all to authenticated using (true);

drop policy if exists "po_messages_read" on po_messages;
drop policy if exists "po_messages_write" on po_messages;
create policy "po_messages_all" on po_messages for all to authenticated using (true);

drop policy if exists "task_comments_read" on task_comments;
drop policy if exists "task_comments_write" on task_comments;
create policy "task_comments_all" on task_comments for all to authenticated using (true);

drop policy if exists "issue_comments_read" on issue_comments;
drop policy if exists "issue_comments_write" on issue_comments;
create policy "issue_comments_all" on issue_comments for all to authenticated using (true);

drop policy if exists "profile_credentials_read" on profile_credentials;
drop policy if exists "profile_credentials_write" on profile_credentials;
create policy "credentials_all" on profile_credentials for all to authenticated using (true);

drop policy if exists "blockers_read" on blockers;
drop policy if exists "blockers_write" on blockers;
create policy "blockers_all" on blockers for all to authenticated using (true);

drop policy if exists "defects_read" on defects;
drop policy if exists "defects_write" on defects;
create policy "defects_all" on defects for all to authenticated using (true);

drop policy if exists "qa_read" on qa_items;
drop policy if exists "qa_write" on qa_items;
create policy "qa_all" on qa_items for all to authenticated using (true);

drop policy if exists "procurement_read" on procurement_items;
drop policy if exists "procurement_write" on procurement_items;
create policy "procurement_all" on procurement_items for all to authenticated using (true);

drop policy if exists "eot_read" on eot_claims;
drop policy if exists "eot_write" on eot_claims;
create policy "eot_all" on eot_claims for all to authenticated using (true);

notify pgrst, 'reload schema';
