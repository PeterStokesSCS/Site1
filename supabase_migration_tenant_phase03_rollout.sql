-- SITE1 multi-tenant — Phase 3 FULL ROLLOUT. Run "without RLS".
--
-- Adds ONE restrictive tenant-isolation policy per org-scoped table. RESTRICTIVE policies
-- are AND-ed with the existing PERMISSIVE policies, so every current access path is kept
-- intact AND every row is additionally required to belong to one of the caller's orgs.
-- This is deliberately NOT a rewrite of each table's policies — it isolates tenants without
-- risking the removal of a legitimate same-org access path (which a rewrite could do).
--
-- Safe because Phase 2 BEFORE-INSERT triggers fill org_id on all 28 covered tables, so the
-- WITH CHECK always passes for legitimate inserts. notification_log has no such trigger, so
-- it gets a SELECT-only gate (a WITH CHECK there would block the email job's writes).
--
-- Idempotent and fully reversible (see _rollback). Validate with tests/sandbox AND a live
-- admin read/write before relying on it.

do $$
declare t text;
begin
  -- Defensive backfill: a NULL org_id row would become invisible/un-writable under the gate
  -- (NULL in (...) is never true) — the exact "disappear" failure mode. Re-derive from the
  -- parent project for every project-scoped table before locking the gate.
  foreach t in array array[
    'project_members','tasks','hazards','issues','timesheets','daily_logs','variations',
    'purchase_orders','commercial_items','milestones','forecast_changes','procurement_items',
    'qa_items','defects','subbie_requests','project_photos','documents','messages',
    'variation_labour','blockers','eot_claims','material_requests','site_visits'
  ] loop
    execute format(
      'update %I c set org_id = p.org_id from projects p where c.project_id = p.id and c.org_id is null', t);
  end loop;

  -- The 28 trigger-covered tables: gate ALL commands (read + write).
  foreach t in array array[
    'projects','project_members','tasks','hazards','issues','timesheets','daily_logs',
    'variations','purchase_orders','commercial_items','milestones','forecast_changes',
    'procurement_items','qa_items','defects','subbie_requests','project_photos','documents',
    'messages','po_messages','task_comments','issue_comments','variation_labour','blockers',
    'eot_claims','material_requests','site_visits','labour_rates'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "tenant_isolation" on %I', t);
    execute format(
      'create policy "tenant_isolation" on %I as restrictive for all to authenticated '
      || 'using (org_id in (select auth_org_ids())) '
      || 'with check (org_id in (select auth_org_ids()))', t);
  end loop;

  -- notification_log: isolate READS only (no insert trigger => no WITH CHECK).
  execute 'alter table notification_log enable row level security';
  execute 'drop policy if exists "tenant_isolation" on notification_log';
  execute 'create policy "tenant_isolation" on notification_log as restrictive for select '
       || 'to authenticated using (org_id in (select auth_org_ids()))';
end $$;
