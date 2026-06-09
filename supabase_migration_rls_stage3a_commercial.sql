-- SITE1 RLS Stage 3a — role-gate the two commercial tables (purchase_orders, variations).
-- Closes the empirically-confirmed RBAC leaks: client could read POs; field staff could read
-- POs + variations. Drops the dev-era wide-open policies and the loose project-membership
-- reads/writes, replacing them with role-aware ones. Run "without RLS".
--
-- NOTE: a FOR ALL policy's USING also grants SELECT, so read AND write are both replaced.
-- The Phase 3 restrictive tenant_isolation gate still ANDs on top (org isolation preserved).
-- Verified safe against the app: WorkerApp reads neither table; ClientApp reads variations
-- (client kept) and approves them (client kept in write); subbies accept POs (subbie kept).

-- ── purchase_orders ──────────────────────────────────────────────────────────────
-- Visible to: the issued subcontractor (own only), builder/office, and the supervisor on
-- that project. NOT field staff, NOT clients.
drop policy if exists "purchase_orders_all"   on purchase_orders;
drop policy if exists "purchase_orders_read"  on purchase_orders;
drop policy if exists "purchase_orders_write" on purchase_orders;

create policy "purchase_orders_read" on purchase_orders for select to authenticated using (
  subbie_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
  or (project_id in (select project_id from project_members where user_id = auth.uid())
      and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor'))
);

create policy "purchase_orders_write" on purchase_orders for all to authenticated
  using (
    subbie_id = auth.uid()                                                            -- subbie accepts
    or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
    or (project_id in (select project_id from project_members where user_id = auth.uid())
        and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor'))
  )
  with check (
    subbie_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
    or (project_id in (select project_id from project_members where user_id = auth.uid())
        and exists (select 1 from profiles where id = auth.uid() and role = 'supervisor'))
  );

-- ── variations ───────────────────────────────────────────────────────────────────
-- Visible to: builder/office, and supervisor OR client who is a member of the project.
-- NOT field staff. (Client read/write kept so the client approval flow keeps working.)
drop policy if exists "variations_all"   on variations;
drop policy if exists "variations_read"  on variations;
drop policy if exists "variations_write" on variations;

create policy "variations_read" on variations for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
  or (project_id in (select project_id from project_members where user_id = auth.uid())
      and exists (select 1 from profiles where id = auth.uid() and role in ('supervisor','client')))
);

create policy "variations_write" on variations for all to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
    or (project_id in (select project_id from project_members where user_id = auth.uid())
        and exists (select 1 from profiles where id = auth.uid() and role in ('supervisor','client')))
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
    or (project_id in (select project_id from project_members where user_id = auth.uid())
        and exists (select 1 from profiles where id = auth.uid() and role in ('supervisor','client')))
  );
