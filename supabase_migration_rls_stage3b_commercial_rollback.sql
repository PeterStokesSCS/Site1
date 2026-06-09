-- Rollback Stage 3b — restores the prior wide-open access on the 3 financial tables.
-- (Returns to pre-Stage-3b behaviour; the Phase 3 restrictive org gate still applies.)
drop policy if exists "commercial_items_read"   on commercial_items;
drop policy if exists "commercial_items_write"  on commercial_items;
drop policy if exists "eot_claims_read"         on eot_claims;
drop policy if exists "eot_claims_write"        on eot_claims;
drop policy if exists "procurement_items_read"  on procurement_items;
drop policy if exists "procurement_items_write" on procurement_items;
create policy "commercial_items_all" on commercial_items for all to authenticated using (true);
create policy "eot_all"              on eot_claims        for all to authenticated using (true);
create policy "procurement_all"      on procurement_items for all to authenticated using (true);
