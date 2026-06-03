-- ================================================================
-- SITE1 — Migration: File uploads (Storage) + variation attachments
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- Public-read bucket for attachments (PDFs, receipts, photos)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Anyone can read; authenticated users can upload/update/delete
create policy "attachments_public_read"
  on storage.objects for select to public
  using (bucket_id = 'attachments');

create policy "attachments_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

create policy "attachments_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'attachments');

create policy "attachments_auth_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');

-- Variations can carry an attachment
alter table variations add column if not exists file_url text;
