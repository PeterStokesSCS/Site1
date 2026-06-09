-- SITE1 multi-tenant — Phase 3 PILOT (tasks only). Re-keys tasks RLS tenant-first.
-- Validate (admin read+write, non-admin scope, and — when a 2nd org exists — isolation)
-- BEFORE rolling this pattern out to the other ~29 tables. Fully reversible (pilot rollback).
-- Pattern: tenant gate first, then project-membership OR org-scoped admin (is_org_admin,
-- replacing the old GLOBAL role check). WITH CHECK is evaluated after the BEFORE-INSERT
-- trigger fills org_id, so legitimate inserts (org_id = the project's org = the user's org) pass.

drop policy if exists "tasks_read" on tasks;
drop policy if exists "tasks_write" on tasks;

create policy "tasks_read" on tasks for select to authenticated using (
  org_id in (select auth_org_ids())
  and ( project_id in (select project_id from project_members where user_id = auth.uid())
        or is_org_admin(org_id) )
);

create policy "tasks_write" on tasks for all to authenticated
  using (
    org_id in (select auth_org_ids())
    and ( project_id in (select project_id from project_members where user_id = auth.uid())
          or is_org_admin(org_id) )
  )
  with check (
    org_id in (select auth_org_ids())
    and ( project_id in (select project_id from project_members where user_id = auth.uid())
          or is_org_admin(org_id) )
  );
