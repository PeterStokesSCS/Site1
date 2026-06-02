-- ================================================================
-- SCS BuildHub — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- Profiles (extends auth.users)
create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  role text check (role in ('builder','supervisor','worker','subcontractor','client','office')),
  phone text,
  company text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  job_number text unique not null,
  street text not null,
  suburb text,
  client_name text,
  client_email text,
  client_phone text,
  status text check (status in ('planning','active','completed','on_hold')) default 'planning',
  phase text,
  progress int default 0,
  budget numeric,
  spent numeric default 0,
  start_date date,
  end_date date,
  health text check (health in ('green','amber','red')) default 'green',
  telegram_chat_id text,
  created_at timestamptz default now()
);

-- Project members
create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  user_id uuid references profiles on delete cascade,
  role text,
  created_at timestamptz default now(),
  unique(project_id, user_id)
);

-- Milestones
create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  name text not null,
  sort_order int default 0,
  done boolean default false,
  completed_date date,
  created_at timestamptz default now()
);

-- Tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  assignee_id uuid references profiles,
  due_date date,
  status text check (status in ('todo','in_progress','completed','blocked')) default 'todo',
  priority text check (priority in ('low','medium','high')) default 'medium',
  created_by uuid references profiles,
  created_at timestamptz default now()
);

-- Hazards
create table hazards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  risk text check (risk in ('low','medium','high')) not null,
  category text,
  control_measures text,
  status text check (status in ('open','resolved')) default 'open',
  reported_by uuid references profiles,
  photo_url text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Timesheets
create table timesheets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  worker_id uuid references profiles,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  hours_worked numeric,
  task_description text,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  approved_by uuid references profiles,
  created_at timestamptz default now()
);

-- Daily logs
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  submitted_by uuid references profiles,
  log_date date not null,
  weather text,
  workers_on_site int,
  progress_notes text,
  deliveries text,
  visitors text,
  issues text,
  created_at timestamptz default now()
);

-- Variations
create table variations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  ref text,
  title text not null,
  description text,
  amount numeric,
  status text check (status in ('pending','approved','rejected','signed')) default 'pending',
  raised_by uuid references profiles,
  approved_by uuid references profiles,
  created_at timestamptz default now()
);

-- Issues / blockers
create table issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  title text not null,
  description text,
  category text,
  priority text check (priority in ('low','medium','high')) default 'medium',
  status text check (status in ('open','in_progress','resolved')) default 'open',
  raised_by uuid references profiles,
  created_at timestamptz default now()
);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  sender_id uuid references profiles,
  channel text check (channel in ('team','trades','client')) default 'team',
  content text not null,
  created_at timestamptz default now()
);

-- Documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  name text not null,
  category text,
  file_url text,
  version text,
  superseded boolean default false,
  uploaded_by uuid references profiles,
  created_at timestamptz default now()
);

-- Material requests
create table material_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  item text not null,
  quantity numeric,
  unit text,
  urgency text check (urgency in ('today','this-week','next-week')),
  requested_by uuid references profiles,
  status text check (status in ('pending','ordered','delivered')) default 'pending',
  notes text,
  created_at timestamptz default now()
);

-- ================================================================
-- Row Level Security
-- ================================================================

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table milestones enable row level security;
alter table tasks enable row level security;
alter table hazards enable row level security;
alter table timesheets enable row level security;
alter table daily_logs enable row level security;
alter table variations enable row level security;
alter table issues enable row level security;
alter table messages enable row level security;
alter table documents enable row level security;
alter table material_requests enable row level security;

-- Profiles: anyone authenticated can read, own row to update
create policy "profiles_read_all" on profiles for select to authenticated using (true);
create policy "profiles_update_own" on profiles for update to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert to authenticated with check (auth.uid() = id);

-- Projects: builders + office see all; others see their assigned projects only
create policy "projects_read" on projects for select to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
  or id in (select project_id from project_members where user_id = auth.uid())
);
create policy "projects_insert" on projects for insert to authenticated with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);
create policy "projects_update" on projects for update to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('builder','office','supervisor'))
);

-- All other tables: same project-based access
create policy "tasks_read" on tasks for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);
create policy "tasks_write" on tasks for all to authenticated using (true);

create policy "hazards_read" on hazards for select to authenticated using (true);
create policy "hazards_write" on hazards for all to authenticated using (true);

create policy "timesheets_read" on timesheets for select to authenticated using (
  worker_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office','supervisor'))
);
create policy "timesheets_write" on timesheets for all to authenticated using (true);

create policy "daily_logs_read" on daily_logs for select to authenticated using (true);
create policy "daily_logs_write" on daily_logs for all to authenticated using (true);

create policy "variations_read" on variations for select to authenticated using (true);
create policy "variations_write" on variations for all to authenticated using (true);

create policy "issues_read" on issues for select to authenticated using (true);
create policy "issues_write" on issues for all to authenticated using (true);

create policy "messages_read" on messages for select to authenticated using (true);
create policy "messages_write" on messages for all to authenticated using (true);

create policy "documents_read" on documents for select to authenticated using (true);
create policy "documents_write" on documents for all to authenticated using (true);

create policy "material_requests_read" on material_requests for select to authenticated using (true);
create policy "material_requests_write" on material_requests for all to authenticated using (true);

create policy "milestones_read" on milestones for select to authenticated using (true);
create policy "milestones_write" on milestones for all to authenticated using (true);

create policy "project_members_read" on project_members for select to authenticated using (true);
create policy "project_members_write" on project_members for all to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role in ('builder','office'))
);

-- ================================================================
-- Auto-create profile on signup
-- ================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
