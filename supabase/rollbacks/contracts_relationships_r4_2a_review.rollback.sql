do $$
begin
  if exists (
    select 1
    from private.contract_relationships relationship
    where relationship.evidence #>> '{signals,schemaVersion}' = 'contracts-relationship-signals.r4.2a.v1'
  ) then
    raise exception 'R4.2A rollback refused while semantic relationship proposals or review revisions exist';
  end if;
end;
$$;

drop function if exists public.bidoc_contracts_review_semantic_relationship_r4_2a(uuid,uuid,integer,uuid,text,text,jsonb);
drop function if exists public.bidoc_contracts_persist_semantic_relationships_r4_2a(uuid,text,text,text,jsonb);
drop function if exists public.bidoc_contracts_get_relationship_review_r4_2a(uuid,text);
drop function if exists public.bidoc_contracts_relationship_review_status_r4_2a();
