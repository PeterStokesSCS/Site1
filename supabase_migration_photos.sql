-- ================================================================
-- SITE1 — Migration: Project Photos
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- (uses the existing public 'attachments' storage bucket)
-- ================================================================

create table if not exists project_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  url text not null,
  caption text,
  taken_by uuid references profiles,
  created_at timestamptz default now()
);

alter table project_photos enable row level security;

create policy "project_photos_read"  on project_photos for select to authenticated using (true);
create policy "project_photos_write" on project_photos for all    to authenticated using (true);
