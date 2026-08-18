-- Phase 3C non-destructive operational rollback.
-- Preserve immutable mapping evidence and current aliases. This file only
-- disables the two Phase 3 database entry points and direct server mutations.

begin;

revoke execute on function public.bidoc_contracts_list_activity_mapping_reviews_v1(uuid, text, text, integer)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_review_activity_mapping_v1(jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_resolve_mapping_context_v1(uuid)
from public, anon, authenticated, service_role;

revoke insert, update on table public.schedule_activity_map from service_role;
revoke insert on table private.schedule_activity_mapping_review_events from service_role;

drop function public.bidoc_contracts_review_activity_mapping_v1(jsonb);
drop function public.bidoc_contracts_resolve_mapping_context_v1(uuid);
drop function public.bidoc_contracts_list_activity_mapping_reviews_v1(uuid, text, text, integer);

commit;

notify pgrst, 'reload schema';
