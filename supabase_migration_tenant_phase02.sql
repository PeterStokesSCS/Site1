-- SITE1 multi-tenant — Phase 2: auto-populate org_id on insert (server-side, ADDITIVE).
-- BEFORE INSERT triggers derive org_id when the app doesn't supply it. SECURITY DEFINER
-- so the parent lookup isn't blocked by RLS; auth.uid() still resolves the real caller.
-- RLS is still unchanged in this phase. notification_log is excluded (written only by the
-- deferred hourly email job, which will set org_id from the entity when built).

create or replace function set_org_from_project() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if NEW.org_id is null and NEW.project_id is not null then
    NEW.org_id := (select org_id from projects where id = NEW.project_id);
  end if; return NEW;
end $$;

create or replace function set_org_from_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if NEW.org_id is null then
    NEW.org_id := (select org_id from org_members where user_id = auth.uid()
                   order by (role in ('builder','office')) desc, created_at limit 1);
  end if; return NEW;
end $$;

create or replace function set_org_from_po() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if NEW.org_id is null and NEW.po_id is not null then
    NEW.org_id := (select org_id from purchase_orders where id = NEW.po_id);
  end if; return NEW;
end $$;

create or replace function set_org_from_task() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if NEW.org_id is null and NEW.task_id is not null then
    NEW.org_id := (select org_id from tasks where id = NEW.task_id);
  end if; return NEW;
end $$;

create or replace function set_org_from_issue() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if NEW.org_id is null and NEW.issue_id is not null then
    NEW.org_id := (select org_id from issues where id = NEW.issue_id);
  end if; return NEW;
end $$;

do $$
declare t text;
begin
  -- project-scoped (direct project_id)
  foreach t in array array[
    'project_members','tasks','hazards','issues','timesheets','daily_logs','variations',
    'purchase_orders','commercial_items','milestones','forecast_changes','procurement_items',
    'qa_items','defects','subbie_requests','project_photos','documents','messages',
    'variation_labour','blockers','eot_claims','material_requests','site_visits'
  ] loop
    execute format('drop trigger if exists trg_set_org on %I', t);
    execute format('create trigger trg_set_org before insert on %I for each row execute function set_org_from_project()', t);
  end loop;
  -- roots (creating user's org)
  foreach t in array array['projects','labour_rates'] loop
    execute format('drop trigger if exists trg_set_org on %I', t);
    execute format('create trigger trg_set_org before insert on %I for each row execute function set_org_from_user()', t);
  end loop;
end $$;

-- parent-derived (no direct project_id)
drop trigger if exists trg_set_org on po_messages;
create trigger trg_set_org before insert on po_messages for each row execute function set_org_from_po();
drop trigger if exists trg_set_org on task_comments;
create trigger trg_set_org before insert on task_comments for each row execute function set_org_from_task();
drop trigger if exists trg_set_org on issue_comments;
create trigger trg_set_org before insert on issue_comments for each row execute function set_org_from_issue();
