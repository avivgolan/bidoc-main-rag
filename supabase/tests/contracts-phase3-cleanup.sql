-- Destructive cleanup for the dedicated local Phase 3 database container only.

drop function if exists public.bidoc_contracts_review_activity_mapping_v1(jsonb);
drop function if exists public.bidoc_contracts_resolve_mapping_context_v1(uuid);
drop function if exists public.bidoc_contracts_promote_review_v1(jsonb);
drop schema if exists private cascade;
drop table if exists public.schedule_activity_map cascade;
drop table if exists public.schedule_contract_conditions cascade;
drop table if exists public.schedule_contract_extensions cascade;
drop table if exists public.schedule_contract_milestones cascade;
drop table if exists public.projects cascade;
drop function if exists public.set_updated_at();
