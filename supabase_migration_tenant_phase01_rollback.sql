-- Rollback for SITE1 multi-tenant Phase 0–1. Drops the org tagging (additive change),
-- not any user data. Safe to run if Phase 1 needs reverting before Phase 2/3.
do $$
declare t text;
begin
  foreach t in array array[
    'projects','project_members','tasks','hazards','issues','timesheets','daily_logs',
    'variations','purchase_orders','commercial_items','milestones','forecast_changes',
    'procurement_items','qa_items','defects','subbie_requests','project_photos','documents',
    'messages','po_messages','task_comments','issue_comments','variation_labour','blockers',
    'eot_claims','material_requests','notification_log','site_visits','labour_rates'
  ] loop
    execute format('drop index if exists %I', 'idx_' || t || '_org');
    execute format('alter table %I drop column if exists org_id', t);
  end loop;
end $$;
-- dropping the tables removes their RLS policies; also drop the helper functions.
drop function if exists is_org_admin(uuid);
drop function if exists auth_org_ids();
drop table if exists org_members;
drop table if exists organisations;
