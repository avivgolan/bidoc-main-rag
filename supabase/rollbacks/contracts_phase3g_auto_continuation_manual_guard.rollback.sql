-- Phase 3G forward-guard rollback.
--
-- Restore the Phase 3C/3F public review RPC implementation without deleting
-- mapping rows or immutable review events. Run this rollback only while the
-- Phase 3G migration is present and before applying the broader Phase 3
-- operational rollback.

begin;

revoke execute on function public.bidoc_contracts_review_activity_mapping_v1(jsonb)
from public, anon, authenticated, service_role;
drop function public.bidoc_contracts_review_activity_mapping_v1(jsonb);

alter function private.bidoc_contracts_review_activity_mapping_phase3c_v1(jsonb)
set schema public;
alter function public.bidoc_contracts_review_activity_mapping_phase3c_v1(jsonb)
rename to bidoc_contracts_review_activity_mapping_v1;

revoke execute on function public.bidoc_contracts_review_activity_mapping_v1(jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.bidoc_contracts_review_activity_mapping_v1(jsonb)
to service_role;

drop function private.bidoc_contracts_lock_activity_mapping_review_v1(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text
);

commit;

notify pgrst, 'reload schema';
