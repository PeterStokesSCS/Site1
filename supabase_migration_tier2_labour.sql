alter table timesheets add column if not exists amendments jsonb default '[]';

create table if not exists variation_labour (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  variation_id uuid references variations on delete set null,
  work_date date,
  worker_ids uuid[] default '{}',
  hours numeric,
  note text,
  photo_url text,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
alter table variation_labour enable row level security;
drop policy if exists "variation_labour_read" on variation_labour;
drop policy if exists "variation_labour_write" on variation_labour;
create policy "variation_labour_read" on variation_labour for select to authenticated using (
  project_id in (select project_id from project_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
create policy "variation_labour_write" on variation_labour for all to authenticated
  using (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (project_id in (select project_id from project_members where user_id = auth.uid())
         or exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));
