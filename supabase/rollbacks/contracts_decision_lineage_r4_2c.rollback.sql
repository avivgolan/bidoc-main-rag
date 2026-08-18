do $$
begin
  if exists (
    select 1 from private.contract_relationships
    where relationship_policy_version = 'contracts-decision-lineage.r4.2c.v1'
  ) then
    raise exception using
      errcode = '55000',
      message = 'R4.2C split/merge lineage exists; preserve the append-only review history';
  end if;
end;
$$;

drop function if exists public.bidoc_contracts_review_decision_lineage_r4_2c(uuid,uuid,text,text,jsonb,jsonb);
drop function if exists public.bidoc_contracts_get_decision_lineage_review_r4_2c(uuid);
drop function if exists public.bidoc_contracts_decision_lineage_status_r4_2c();

alter table private.contract_relationships
  drop constraint contract_relationships_relationship_type_check;

alter table private.contract_relationships
  add constraint contract_relationships_relationship_type_check
  check (relationship_type in (
    'cross_reference',
    'supports_same_decision',
    'depends_on',
    'condition_of',
    'exception_to',
    'amends',
    'duplicates',
    'conflicts_with'
  )) not valid;

alter table private.contract_relationships
  validate constraint contract_relationships_relationship_type_check;
