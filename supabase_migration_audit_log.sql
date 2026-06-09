-- SITE1 — Audit log infrastructure (additive, RLS-locked at creation). Run "without RLS".
-- Append-only security/event log. Writes go through record_audit() (SECURITY DEFINER) so a
-- user cannot forge another org/user; reads are restricted to that org's admins.

create table if not exists audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid,                         -- nullable: pre-auth events (failed login) have none
  user_id     uuid references profiles,
  role        text,
  entity_type text,                         -- 'task' | 'variation' | 'purchase_order' | 'auth' | ...
  entity_id   uuid,
  action      text not null,                -- 'login' | 'login_failed' | 'permission_denied'
                                            -- | 'create' | 'update' | 'delete' | 'visibility_approved'
                                            -- | 'variation_sent' | 'variation_signed' | 'po_issued'
                                            -- | 'role_changed' | 'assignment_changed' | 'user_disabled'
  success     boolean not null default true,
  detail      jsonb default '{}'::jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_org_created_idx    on audit_log (org_id, created_at desc);
create index if not exists audit_log_entity_idx         on audit_log (entity_type, entity_id);
create index if not exists audit_log_user_idx           on audit_log (user_id, created_at desc);

-- Append-only writer. Stamps the caller's identity; the app passes context only.
create or replace function record_audit(
  p_org uuid, p_entity_type text, p_entity_id uuid, p_action text,
  p_success boolean default true, p_detail jsonb default '{}'::jsonb,
  p_ip text default null, p_user_agent text default null
) returns void
  language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from profiles where id = auth.uid();
  insert into audit_log (org_id, user_id, role, entity_type, entity_id, action,
                         success, detail, ip, user_agent)
  values (p_org, auth.uid(), v_role, p_entity_type, p_entity_id, p_action,
          p_success, coalesce(p_detail,'{}'::jsonb), p_ip, p_user_agent);
end $$;

alter table audit_log enable row level security;

-- Read: only admins of the row's org. No UPDATE/DELETE policy => append-only for everyone.
drop policy if exists "audit_log_admin_read" on audit_log;
create policy "audit_log_admin_read" on audit_log for select to authenticated
  using (org_id is not null and is_org_admin(org_id));

-- Direct INSERT is denied (no insert policy + RLS on); all writes must go via record_audit().
