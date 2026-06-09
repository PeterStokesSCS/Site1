-- Rollback Phase 3 full rollout — drops every restrictive tenant_isolation policy.
-- Existing permissive policies (and the tasks pilot's tenant-first policies) are untouched,
-- so the app returns to its pre-rollout (global-role) isolation behaviour.
do $$
declare t text;
begin
  foreach t in array array[
    'projects','project_members','tasks','hazards','issues','timesheets','daily_logs',
    'variations','purchase_orders','commercial_items','milestones','forecast_changes',
    'procurement_items','qa_items','defects','subbie_requests','project_photos','documents',
    'messages','po_messages','task_comments','issue_comments','variation_labour','blockers',
    'eot_claims','material_requests','site_visits','labour_rates','notification_log'
  ] loop
    execute format('drop policy if exists "tenant_isolation" on %I', t);
  end loop;
end $$;
