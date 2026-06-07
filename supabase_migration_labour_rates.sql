create table if not exists labour_rates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles on delete cascade unique,
  hourly_rate numeric,
  updated_at timestamptz default now()
);
alter table labour_rates enable row level security;
drop policy if exists "labour_rates_admin" on labour_rates;
create policy "labour_rates_admin" on labour_rates for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('builder','office')));

alter table projects add column if not exists labour_budget numeric;
