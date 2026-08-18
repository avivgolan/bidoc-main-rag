do $$
begin
  if exists (
    select 1
    from private.contract_relationships
    where relationship_policy_version = 'contracts-relationships-explicit-reference.r4.0.v1'
  ) then
    raise exception using
      errcode = '55000',
      message = 'R4.0 rollback refused while explicit-reference relationship proposals exist';
  end if;
end;
$$;

drop function if exists public.bidoc_contracts_persist_explicit_relationships_r4_0(uuid,text);
drop function if exists public.bidoc_contracts_get_relationships_r4_0(uuid,text);
drop function if exists public.bidoc_contracts_relationships_status_r4_0();
