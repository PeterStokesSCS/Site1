alter table project_photos add column if not exists visibility_status text default 'none';
alter table project_photos add column if not exists visibility_requested_by uuid references profiles;
alter table project_photos add column if not exists visibility_requested_at timestamptz;

alter table defects add column if not exists visibility_status text default 'none';
alter table defects add column if not exists visibility_requested_by uuid references profiles;
alter table defects add column if not exists visibility_requested_at timestamptz;
