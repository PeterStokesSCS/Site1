-- SITE1 — Storage hardening: make 'attachments' PRIVATE and org-scoped. Run "without RLS".
-- Pairs with the storage.js refactor that uploads under '<org_id>/<folder>/<file>' and serves
-- via createSignedUrl (short TTL) instead of getPublicUrl.
--
-- ORDER OF OPERATIONS (do NOT flip public->private until objects are re-pathed, or existing
-- photos 404): 1) deploy storage.js change so NEW uploads are org-prefixed + signed;
-- 2) migrate EXISTING objects under an org prefix; 3) run this migration. Until then, existing
-- public URLs keep working. R2 in the report tracks this.

-- 1) Flip the bucket private (signed URLs only).
update storage.buckets set public = false where id = 'attachments';

-- 2) RLS on storage.objects, keyed on the first path segment = org id.
--    A user may read/write/delete an object only if its org-prefix is one of their orgs.
alter table storage.objects enable row level security;

drop policy if exists "attachments_org_read"   on storage.objects;
drop policy if exists "attachments_org_write"  on storage.objects;
drop policy if exists "attachments_org_update" on storage.objects;
drop policy if exists "attachments_org_delete" on storage.objects;

create policy "attachments_org_read" on storage.objects for select to authenticated
  using ( bucket_id = 'attachments'
          and ((storage.foldername(name))[1])::uuid in (select auth_org_ids()) );

create policy "attachments_org_write" on storage.objects for insert to authenticated
  with check ( bucket_id = 'attachments'
               and ((storage.foldername(name))[1])::uuid in (select auth_org_ids()) );

create policy "attachments_org_update" on storage.objects for update to authenticated
  using ( bucket_id = 'attachments'
          and ((storage.foldername(name))[1])::uuid in (select auth_org_ids()) );

create policy "attachments_org_delete" on storage.objects for delete to authenticated
  using ( bucket_id = 'attachments'
          and ((storage.foldername(name))[1])::uuid in (select auth_org_ids()) );
