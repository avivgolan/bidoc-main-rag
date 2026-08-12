-- Phase 3D advisor follow-up: cover the full composite project-mapping FK.
-- The table is empty at apply time, and drop/create remains one short migration
-- transaction so the original leading-column index is never absent at commit.

drop index private.samre_project_mapping_fk_idx;

create index samre_project_mapping_fk_idx
  on private.schedule_activity_mapping_review_events (project_mapping_id, project_id);
