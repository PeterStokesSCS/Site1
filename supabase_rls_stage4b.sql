-- ================================================================
-- SITE1 — RLS Hardening Stage 4b: scope the remaining "FOR ALL" tables
-- ================================================================
-- Each of these tables currently has ONE permissive `for all using(true)`
-- policy covering both read and write. We replace each with a scoped READ
-- and a scoped WRITE policy. Builders/office bypass via the admin clause.
-- Ownership clauses let subbies act on their own requests/POs/messages and
-- authors on their own comments, without needing project membership.
-- Fully reversible: run supabase_rls_stage4b_rollback.sql.
-- ================================================================
-- admin  = exists (select 1 from profiles where id=auth.uid() and role in ('builder','office'))
-- member = project_id in (select project_id from project_members where user_id=auth.uid())
-- ================================================================

-- commercial_items (project-keyed)
drop policy if exists "commercial_items_all" on commercial_items;
drop policy if exists "commercial_items_read" on commercial_items;
drop policy if exists "commercial_items_write" on commercial_items;
create policy "commercial_items_read" on commercial_items for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "commercial_items_write" on commercial_items for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- site_visits (project-keyed; recorded_by may self-insert e.g. subbie sign-in)
drop policy if exists "site_visits_all" on site_visits;
drop policy if exists "site_visits_read" on site_visits;
drop policy if exists "site_visits_write" on site_visits;
create policy "site_visits_read" on site_visits for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "site_visits_write" on site_visits for all to authenticated
  using (recorded_by = auth.uid()
         or project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (recorded_by = auth.uid()
         or project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- subbie_requests (subbie owns own; builder/member reviews)
drop policy if exists "subbie_requests_all" on subbie_requests;
drop policy if exists "subbie_requests_read" on subbie_requests;
drop policy if exists "subbie_requests_write" on subbie_requests;
create policy "subbie_requests_read" on subbie_requests for select to authenticated using (
  submitted_by = auth.uid()
  or project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "subbie_requests_write" on subbie_requests for all to authenticated
  using (submitted_by = auth.uid()
         or project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (submitted_by = auth.uid()
         or project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- purchase_orders (subbie owns own; builder/member issues)
drop policy if exists "purchase_orders_all" on purchase_orders;
drop policy if exists "purchase_orders_read" on purchase_orders;
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

-- po_messages (read open to keep threads working; write = own message or admin)
drop policy if exists "po_messages_all" on po_messages;
drop policy if exists "po_messages_read" on po_messages;
drop policy if exists "po_messages_write" on po_messages;
create policy "po_messages_read" on po_messages for select to authenticated using (true);
create policy "po_messages_write" on po_messages for all to authenticated
  using (sender_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (sender_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- task_comments (read open; write = own comment or admin)
drop policy if exists "task_comments_all" on task_comments;
drop policy if exists "task_comments_read" on task_comments;
drop policy if exists "task_comments_write" on task_comments;
create policy "task_comments_read" on task_comments for select to authenticated using (true);
create policy "task_comments_write" on task_comments for all to authenticated
  using (author_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (author_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- issue_comments (read open; write = own comment or admin)
drop policy if exists "issue_comments_all" on issue_comments;
drop policy if exists "issue_comments_read" on issue_comments;
drop policy if exists "issue_comments_write" on issue_comments;
create policy "issue_comments_read" on issue_comments for select to authenticated using (true);
create policy "issue_comments_write" on issue_comments for all to authenticated
  using (author_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (author_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- profile_credentials (own credentials or admin)
drop policy if exists "credentials_all" on profile_credentials;
drop policy if exists "profile_credentials_read" on profile_credentials;
drop policy if exists "profile_credentials_write" on profile_credentials;
create policy "profile_credentials_read" on profile_credentials for select to authenticated using (
  profile_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "profile_credentials_write" on profile_credentials for all to authenticated
  using (profile_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (profile_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

-- Phase-2 project tables (no UI yet — scoped for hygiene)
drop policy if exists "blockers_all" on blockers;
create policy "blockers_read" on blockers for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "blockers_write" on blockers for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

drop policy if exists "defects_all" on defects;
create policy "defects_read" on defects for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "defects_write" on defects for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

drop policy if exists "qa_all" on qa_items;
create policy "qa_read" on qa_items for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "qa_write" on qa_items for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

drop policy if exists "procurement_all" on procurement_items;
create policy "procurement_read" on procurement_items for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "procurement_write" on procurement_items for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

drop policy if exists "eot_all" on eot_claims;
create policy "eot_read" on eot_claims for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "eot_write" on eot_claims for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

notify pgrst, 'reload schema';
