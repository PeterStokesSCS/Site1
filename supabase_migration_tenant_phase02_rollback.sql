-- Rollback for SITE1 multi-tenant Phase 2. Drops the org_id auto-population triggers
-- and their functions. Additive change reversed; no data touched.
do $$
declare t text;
begin
  foreach t in array array[
    'project_members','tasks','hazards','issues','timesheets','daily_logs','variations',
    'purchase_orders','commercial_items','milestones','forecast_changes','procurement_items',
    'qa_items','defects','subbie_requests','project_photos','documents','messages',
    'variation_labour','blockers','eot_claims','material_requests','site_visits',
    'projects','labour_rates','po_messages','task_comments','issue_comments'
  ] loop
    execute format('drop trigger if exists trg_set_org on %I', t);
  end loop;
end $$;
drop function if exists set_org_from_project();
drop function if exists set_org_from_user();
drop function if exists set_org_from_po();
drop function if exists set_org_from_task();
drop function if exists set_org_from_issue();
