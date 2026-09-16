-- R3.2 private workspaces were PDF-only. File Classify now persists DOCX
-- through the same automatic pipeline, so the saved-workspace row must accept
-- Word MIME types and the same 20MB decoded-document cap as extract/persist.

alter table private.contract_workspaces
  drop constraint if exists contract_workspaces_media_type_check;

alter table private.contract_workspaces
  add constraint contract_workspaces_media_type_check
  check (
    media_type = any (array[
      'application/pdf'::text,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text
    ])
  );

alter table private.contract_workspaces
  drop constraint if exists contract_workspaces_byte_count_check;

alter table private.contract_workspaces
  add constraint contract_workspaces_byte_count_check
  check (byte_count > 0 and byte_count <= 20000000);
