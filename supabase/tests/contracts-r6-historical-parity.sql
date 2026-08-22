-- Production acceptance query for the two Contracts workspaces used in the CTO review.

do $acceptance$
begin
  if to_regclass('private.contracts_workspace_parity_r6_v1') is null
     or to_regprocedure('public.bidoc_contracts_r6_embedding_work_v2(uuid)') is null then
    raise exception 'Contracts R6 historical parity objects are missing';
  end if;

  if has_function_privilege('anon', 'public.bidoc_contracts_r6_embedding_work_v2(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.bidoc_contracts_r6_embedding_work_v2(uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.bidoc_contracts_r6_embedding_work_v2(uuid)', 'EXECUTE') then
    raise exception 'Contracts R6 historical parity RPC privileges are invalid';
  end if;

  if (
    select count(*)
    from private.contracts_workspace_parity_r6_v1 parity
    where parity.workspace_id in (
      '82345c75-c6f4-468d-b899-1f8407d9a9c1'::uuid,
      '4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa'::uuid
    )
      and parity.parity_ready
  ) <> 2 then
    raise exception 'Both CTO review contracts must have complete R6 fields, Hebrew tags, and current embeddings';
  end if;
end
$acceptance$;

select
  parity.workspace_id,
  parity.document_name,
  parity.document_rows,
  parity.document_required_fields_ready_rows,
  parity.document_embedding_ready_rows,
  parity.document_catalog_ready_rows,
  parity.current_decision_rows,
  parity.decision_required_fields_ready_rows,
  parity.current_decision_embedding_ready_rows,
  parity.decision_revision_rows,
  parity.decision_revision_embedding_ready_rows,
  parity.parity_ready
from private.contracts_workspace_parity_r6_v1 parity
where parity.workspace_id in (
  '82345c75-c6f4-468d-b899-1f8407d9a9c1'::uuid,
  '4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa'::uuid
)
order by parity.document_name;
